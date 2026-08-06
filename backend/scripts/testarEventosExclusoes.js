require('dotenv').config({ quiet: true });
process.env.PUBLICO_LIMITE_MAXIMO = '20';

const assert = require('assert');
const bcrypt = require('bcrypt');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const formatarTelefone = require('../src/utils/formatarTelefone');
const formatarDataRio = require('../src/utils/formatarDataRio');

const SENHA = 'TesteEventos123!';
let total = 0;

function verificar(condicao, mensagem) {
  total += 1;
  assert.ok(condicao, mensagem);
}

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  let corpo = {};
  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    corpo = await resposta.json();
  }
  return { status: resposta.status, corpo };
}

async function login(baseUrl, email) {
  return requisitar(baseUrl, '/api/autenticacao/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: SENHA })
  });
}

function cabecalhos(token) {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}

async function limparDadosTeste() {
  const emails = ['eventos.admin@invalid.local', 'eventos.operador@invalid.local'];
  const telefones = ['21999001122', '21999001133', '21999001144', '21999001155'];
  await banco.query(
    `DELETE FROM consentimentos
     WHERE contato_id_original IN (
       SELECT contato_id_original FROM solicitacoes_exclusao
       WHERE solicitada_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))
     )`,
    [emails]
  );
  await banco.query(
    `DELETE FROM solicitacoes_exclusao
     WHERE solicitada_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))`,
    [emails]
  );
  await banco.query(
    `DELETE FROM contato_eventos
     WHERE evento_id IN (
       SELECT id FROM eventos
       WHERE criado_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))
     )`,
    [emails]
  );
  await banco.query(
    `DELETE FROM eventos
     WHERE criado_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))`,
    [emails]
  );
  await banco.query(
    `DELETE FROM consentimentos
     WHERE contato_id IN (SELECT id FROM contatos WHERE telefone_normalizado = ANY($1::text[]))`,
    [telefones]
  );
  await banco.query('DELETE FROM contatos WHERE telefone_normalizado = ANY($1::text[])', [telefones]);
  await banco.query('DELETE FROM tentativas_login WHERE email_informado = ANY($1::text[])', [emails]);
  await banco.query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [emails]);
}

async function executar() {
  let servidor;
  let idsEventosAtivosPreservados = [];
  const emailAdmin = 'eventos.admin@invalid.local';
  const emailOperador = 'eventos.operador@invalid.local';
  const telefoneEvento = '21999001122';
  const telefoneGeral = '21999001133';
  const telefoneExistenteEvento = '21999001144';

  try {
    await limparDadosTeste();
    const eventosAtivos = await banco.query(
      "SELECT id FROM eventos WHERE status = 'ativo' ORDER BY id"
    );
    idsEventosAtivosPreservados = eventosAtivos.rows.map(function (evento) {
      return evento.id;
    });
    if (idsEventosAtivosPreservados.length > 0) {
      await banco.query(
        "UPDATE eventos SET status = 'rascunho' WHERE id = ANY($1::bigint[])",
        [idsEventosAtivosPreservados]
      );
    }
    const senhaHash = await bcrypt.hash(SENHA, 4);
    await banco.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ('Admin Eventos', $1, $3, 'administrador'),
              ('Operador Eventos', $2, $3, 'operador')`,
      [emailAdmin, emailOperador, senhaHash]
    );

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const admin = await login(baseUrl, emailAdmin);
    const operador = await login(baseUrl, emailOperador);
    verificar(admin.status === 200, 'Login do administrador falhou.');
    verificar(operador.status === 200, 'Login do operador falhou.');
    const adminHeaders = cabecalhos(admin.corpo.token);
    const operadorHeaders = cabecalhos(operador.corpo.token);

    verificar((await requisitar(baseUrl, '/api/admin/eventos')).status === 401, 'Eventos sem JWT não retornou 401.');
    verificar((await requisitar(baseUrl, '/api/admin/eventos', { method: 'POST', headers: operadorHeaders, body: '{}' })).status === 403, 'Operador conseguiu criar evento.');

    const cadastroAnterior = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Contato já cadastrado',
        telefone: telefoneExistenteEvento,
        idade: 34,
        bairro: 'Bangu',
        problema: 'Educação',
        aceitePrivacidade: true,
        autorizacaoMensagens: false,
        autorizacaoLigacoes: false,
        eventoIdExibido: null
      })
    });
    verificar(
      cadastroAnterior.status === 201 && cadastroAnterior.corpo.evento === null,
      'Cadastro geral anterior ao evento falhou.'
    );
    const contatoAnterior = await banco.query(
      `SELECT id, origem_id, nome, bairro, problema, idade
       FROM contatos WHERE telefone_normalizado = $1`,
      [telefoneExistenteEvento]
    );
    const origemOriginalId = contatoAnterior.rows[0].origem_id;

    const hoje = formatarDataRio(new Date());
    const criacao = await requisitar(baseUrl, '/api/admin/eventos', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ nome: 'Mutirão comunitário', motivo: 'Ouvir moradores', dataInicial: hoje, dataFinal: hoje })
    });
    verificar(criacao.status === 201, 'Evento não foi criado.');
    const eventoId = criacao.corpo.evento.id;
    const edicao = await requisitar(baseUrl, '/api/admin/eventos/' + eventoId, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ nome: 'Mutirão do bairro', motivo: 'Ouvir moradores', dataInicial: hoje, dataFinal: hoje })
    });
    verificar(edicao.status === 200, 'Evento em rascunho não foi editado.');
    verificar((await requisitar(baseUrl, '/api/admin/eventos/' + eventoId + '/ativar', { method: 'POST', headers: adminHeaders })).status === 200, 'Evento não foi ativado.');

    const contextoDesatualizado = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Contexto desatualizado',
        telefone: '21999001155',
        idade: 30,
        bairro: 'Bangu',
        problema: 'Educação',
        aceitePrivacidade: true,
        autorizacaoMensagens: false,
        autorizacaoLigacoes: false,
        eventoIdExibido: null
      })
    });
    verificar(
      contextoDesatualizado.status === 201 && contextoDesatualizado.corpo.evento === null,
      'Formulário com contexto de evento desatualizado não foi recusado.'
    );
    const contatoContextoDesatualizado = await banco.query(
      'SELECT COUNT(*)::integer AS total FROM contatos WHERE telefone_normalizado = $1',
      ['21999001155']
    );
    verificar(
      contatoContextoDesatualizado.rows[0].total === 1,
      'Contexto desatualizado persistiu contato parcialmente.'
    );

    const dadosDivergentes = {
      nome: 'Nome diferente informado no evento',
      telefone: '(21) 99900-1144',
      idade: 45,
      bairro: 'Vila Kennedy',
      problema: 'Saúde',
      aceitePrivacidade: true,
      autorizacaoMensagens: false,
      autorizacaoLigacoes: false,
      eventoIdExibido: eventoId
    };
    const inscricaoExistente = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify(dadosDivergentes)
    });
    verificar(
      inscricaoExistente.status === 422,
      'Nome divergente conseguiu usar um telefone já cadastrado.'
    );
    let contatoDepoisDaInscricao = await banco.query(
      `SELECT id, origem_id, nome, bairro, problema, idade
       FROM contatos WHERE telefone_normalizado = $1`,
      [telefoneExistenteEvento]
    );
    verificar(
      contatoDepoisDaInscricao.rows[0].origem_id === origemOriginalId,
      'Participação no evento alterou a origem original do contato.'
    );
    verificar(
      contatoDepoisDaInscricao.rows[0].nome === 'Contato já cadastrado',
      'Tentativa divergente alterou o cadastro existente.'
    );
    let totalVinculosExistente = await banco.query(
      'SELECT COUNT(*)::integer AS total FROM contato_eventos WHERE contato_id = $1 AND evento_id = $2',
      [contatoDepoisDaInscricao.rows[0].id, eventoId]
    );
    verificar(totalVinculosExistente.rows[0].total === 0, 'Tentativa divergente criou vínculo com evento.');

    const identificacaoDivergente = await requisitar(
      baseUrl,
      '/api/publico/contatos/verificar-evento',
      {
        method: 'POST',
        body: JSON.stringify({
          nome: dadosDivergentes.nome,
          telefone: dadosDivergentes.telefone,
          eventoIdExibido: eventoId
        })
      }
    );
    verificar(
      identificacaoDivergente.status === 422 &&
        !Object.prototype.hasOwnProperty.call(identificacaoDivergente.corpo, 'contato'),
      'Identificação divergente expôs ou confirmou dados do contato.'
    );

    const identificacaoExistente = await requisitar(
      baseUrl,
      '/api/publico/contatos/verificar-evento',
      {
        method: 'POST',
        body: JSON.stringify({
          nome: '  contato JÁ cadastrado  ',
          telefone: '(21) 99900-1144',
          eventoIdExibido: eventoId
        })
      }
    );
    verificar(
      identificacaoExistente.status === 200 &&
        identificacaoExistente.corpo.situacao === 'contato_encontrado' &&
        !Object.prototype.hasOwnProperty.call(identificacaoExistente.corpo, 'contato'),
      'Nome completo e telefone válidos não identificaram o cadastro com privacidade.'
    );

    const dadosConfirmacao = {
      nome: 'Contato já cadastrado',
      telefone: '(21) 99900-1144',
      eventoIdExibido: eventoId
    };
    const confirmacaoExistente = await requisitar(
      baseUrl,
      '/api/publico/contatos/inscrever-evento',
      {
        method: 'POST',
        body: JSON.stringify(dadosConfirmacao)
      }
    );
    verificar(
      confirmacaoExistente.status === 200 &&
        confirmacaoExistente.corpo.inscricaoEventoCriada === true,
      'Contato existente não foi inscrito após a confirmação.'
    );

    const inscricaoRepetida = await requisitar(baseUrl, '/api/publico/contatos/inscrever-evento', {
      method: 'POST',
      body: JSON.stringify(dadosConfirmacao)
    });
    verificar(
      inscricaoRepetida.status === 200 &&
        inscricaoRepetida.corpo.jaInscritoEvento === true &&
        inscricaoRepetida.corpo.mensagem.includes('já está registrada'),
      'Inscrição repetida não informou que o contato já participava do evento.'
    );
    totalVinculosExistente = await banco.query(
      'SELECT COUNT(*)::integer AS total FROM contato_eventos WHERE contato_id = $1 AND evento_id = $2',
      [contatoDepoisDaInscricao.rows[0].id, eventoId]
    );
    verificar(
      totalVinculosExistente.rows[0].total === 1,
      'Confirmação repetida duplicou o vínculo com o evento.'
    );

    const atualizacaoDeclarada = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Contato atualizado no evento',
        nomeConfirmacao: 'Contato já cadastrado',
        atualizarDadosEvento: true,
        telefone: '(21) 99900-1144',
        idade: 35,
        bairro: 'Vila Kennedy',
        problema: 'Saúde',
        aceitePrivacidade: true,
        autorizacaoMensagens: false,
        autorizacaoLigacoes: false,
        eventoIdExibido: eventoId
      })
    });
    verificar(
      atualizacaoDeclarada.status === 200 &&
        atualizacaoDeclarada.corpo.jaInscritoEvento === true,
      'Atualização declarada antes da participação falhou.'
    );
    contatoDepoisDaInscricao = await banco.query(
      `SELECT id, origem_id, nome, bairro, problema, idade
       FROM contatos WHERE telefone_normalizado = $1`,
      [telefoneExistenteEvento]
    );
    verificar(
      contatoDepoisDaInscricao.rows[0].nome === 'Contato atualizado no evento' &&
        contatoDepoisDaInscricao.rows[0].bairro === 'Vila Kennedy' &&
        contatoDepoisDaInscricao.rows[0].problema === 'Saúde' &&
        contatoDepoisDaInscricao.rows[0].idade === 35 &&
        contatoDepoisDaInscricao.rows[0].origem_id === origemOriginalId,
      'Atualização não preservou os dados declarados ou a origem original.'
    );
    const historicoAtualizacao = await banco.query(
      `SELECT COUNT(*)::integer AS total FROM historico_contatos
       WHERE contato_id = $1 AND tipo_evento = 'atualizacao_cadastro_publico_evento'`,
      [contatoDepoisDaInscricao.rows[0].id]
    );
    verificar(
      historicoAtualizacao.rows[0].total === 1,
      'Atualização declarada não gerou uma única entrada de auditoria.'
    );

    const buscaNomeParticipante = await requisitar(
      baseUrl,
      '/api/admin/contatos?eventoId=' + eventoId + '&nome=' +
        encodeURIComponent('Contato atualizado no evento'),
      { headers: operadorHeaders }
    );
    verificar(
      buscaNomeParticipante.status === 200 &&
        buscaNomeParticipante.corpo.contatos.some(function (contato) {
          return contato.telefone === formatarTelefone(telefoneExistenteEvento);
        }),
      'Busca de participante por nome completo falhou.'
    );
    const buscaTelefoneParticipante = await requisitar(
      baseUrl,
      '/api/admin/contatos?eventoId=' + eventoId + '&telefone=' +
        encodeURIComponent('(21) 99900-1144'),
      { headers: operadorHeaders }
    );
    verificar(
      buscaTelefoneParticipante.status === 200 &&
        buscaTelefoneParticipante.corpo.contatos.length === 1,
      'Busca de participante por telefone formatado falhou.'
    );

    const opcoesComEvento = await requisitar(baseUrl, '/api/publico/contatos/opcoes');
    verificar(opcoesComEvento.status === 200 && opcoesComEvento.corpo.eventoAtivo === null, 'Formulário geral foi vinculado automaticamente a evento.');
    const opcoesQrEvento = await requisitar(
      baseUrl,
      '/api/publico/contatos/opcoes?eventoId=' + eventoId
    );
    verificar(
      opcoesQrEvento.status === 200 &&
        opcoesQrEvento.corpo.eventoAtivo.id === eventoId,
      'QR Code exclusivo não confirmou o evento ativo.'
    );
    verificar(
      (await requisitar(baseUrl, '/api/publico/contatos/opcoes?eventoId=invalido')).status === 400,
      'QR Code com identificador inválido não foi recusado.'
    );
    const identificacaoContatoNovo = await requisitar(
      baseUrl,
      '/api/publico/contatos/verificar-evento',
      {
        method: 'POST',
        body: JSON.stringify({
          nome: 'Contato Evento',
          telefone: telefoneEvento,
          eventoIdExibido: eventoId
        })
      }
    );
    verificar(
      identificacaoContatoNovo.status === 200 &&
        identificacaoContatoNovo.corpo.situacao === 'novo',
      'Telefone novo não abriu o fluxo de cadastro completo.'
    );
    const cadastroEvento = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Contato Evento', telefone: telefoneEvento, idade: 30, bairro: 'Vila Kennedy', problema: 'Saúde', aceitePrivacidade: true, autorizacaoMensagens: true, autorizacaoLigacoes: true, eventoIdExibido: eventoId })
    });
    verificar(cadastroEvento.status === 201 && cadastroEvento.corpo.evento.id === eventoId, 'Cadastro não foi vinculado ao evento.');
    const filtroEvento = await requisitar(baseUrl, '/api/admin/contatos?eventoId=' + eventoId, { headers: operadorHeaders });
    verificar(filtroEvento.status === 200 && filtroEvento.corpo.contatos.length === 2, 'Filtro por evento falhou.');
    verificar(filtroEvento.corpo.contatos.some(function (contato) {
      return contato.eventos.some(function (evento) {
        return evento.nome === 'Mutirão do bairro' && Boolean(evento.cadastradoEm);
      });
    }), 'Listagem não mostrou evento e data de vínculo.');
    const contatoInscritoNovo = filtroEvento.corpo.contatos.find(function (contato) {
      return contato.telefone === formatarTelefone(telefoneEvento);
    });
    const contatoId = contatoInscritoNovo.id;

    verificar((await requisitar(baseUrl, '/api/admin/relatorios/exportar.csv', { headers: operadorHeaders })).status === 403, 'Operador conseguiu exportar CSV.');
    verificar((await requisitar(baseUrl, '/api/admin/relatorios/exportar.xlsx', { headers: operadorHeaders })).status === 403, 'Operador conseguiu exportar Excel.');
    verificar((await requisitar(baseUrl, '/api/admin/contatos/' + contatoId, { method: 'DELETE', headers: operadorHeaders })).status === 404, 'Operador encontrou exclusão direta de contato.');

    const revogacao = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/revogar-consentimentos', {
      method: 'POST',
      headers: operadorHeaders,
      body: JSON.stringify({ tipo: 'mensagens', motivo: 'Solicitação da pessoa' })
    });
    verificar(revogacao.status === 200, 'Revogação não foi registrada.');
    const trilhaRevogacao = await banco.query(
      `SELECT id, estado, registro_anterior_id FROM consentimentos
       WHERE contato_id = $1 AND tipo = 'mensagens' ORDER BY id`,
      [contatoId]
    );
    verificar(trilhaRevogacao.rowCount === 2, 'Revogação não preservou o registro anterior.');
    verificar(Boolean(trilhaRevogacao.rows[1].registro_anterior_id), 'Revogação não referencia o registro anterior.');

    const solicitacao = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao', {
      method: 'POST', headers: operadorHeaders, body: JSON.stringify({ observacoes: 'Pedido recebido' })
    });
    verificar(solicitacao.status === 200, 'Operador não conseguiu solicitar exclusão.');
    const solicitacaoId = solicitacao.corpo.solicitacaoId;
    verificar((await requisitar(baseUrl, '/api/admin/solicitacoes-exclusao/' + solicitacaoId + '/aprovar', { method: 'POST', headers: operadorHeaders })).status === 403, 'Operador conseguiu aprovar exclusão.');
    verificar((await requisitar(baseUrl, '/api/admin/solicitacoes-exclusao', { headers: operadorHeaders })).status === 403, 'Operador conseguiu listar fila administrativa de exclusões.');
    const aprovacao = await requisitar(baseUrl, '/api/admin/solicitacoes-exclusao/' + solicitacaoId + '/aprovar', { method: 'POST', headers: adminHeaders });
    verificar(aprovacao.status === 200, 'Administrador não conseguiu aprovar exclusão.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM contatos WHERE id = $1', [contatoId])).rows[0].total) === 0, 'Contato não foi excluído fisicamente.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM consentimentos WHERE contato_id_original = $1', [contatoId])).rows[0].total) >= 3, 'Consentimentos/revogações foram apagados.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM solicitacoes_exclusao WHERE id = $1 AND status = \'aprovada\' AND contato_id IS NULL', [solicitacaoId])).rows[0].total) === 1, 'Pedido aprovado não foi preservado sem dados pessoais.');

    verificar((await requisitar(baseUrl, '/api/admin/eventos/' + eventoId + '/encerrar', { method: 'POST', headers: adminHeaders })).status === 200, 'Evento não foi encerrado.');
    verificar(
      (await requisitar(
        baseUrl,
        '/api/publico/contatos/opcoes?eventoId=' + eventoId
      )).status === 410,
      'QR Code continuou aceitando inscrições após o encerramento do evento.'
    );
    const opcoesGerais = await requisitar(baseUrl, '/api/publico/contatos/opcoes');
    verificar(opcoesGerais.corpo.eventoAtivo === null && opcoesGerais.corpo.contextoCadastro === null, 'Formulário sem evento exibiu contexto desnecessário.');
    const cadastroGeral = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Contato Geral', telefone: telefoneGeral, idade: 40, bairro: 'Vila Kennedy', problema: 'Educação', aceitePrivacidade: true, autorizacaoMensagens: false, autorizacaoLigacoes: false, eventoIdExibido: null })
    });
    verificar(cadastroGeral.status === 201 && cadastroGeral.corpo.evento === null, 'Cadastro geral sem evento foi bloqueado ou vinculado indevidamente.');
    const semEvento = await requisitar(baseUrl, '/api/admin/contatos?eventoId=sem_evento', { headers: adminHeaders });
    verificar(semEvento.status === 200 && semEvento.corpo.contatos.some(function (item) { return item.telefone === formatarTelefone(telefoneGeral); }), 'Filtro de cadastros gerais falhou.');

    const totalInscricoesAntesExclusao = Number((await banco.query(
      'SELECT COUNT(*) AS total FROM contato_eventos WHERE evento_id=$1',
      [eventoId]
    )).rows[0].total);
    verificar(
      (await requisitar(baseUrl, '/api/admin/eventos/' + eventoId, {
        method: 'DELETE', headers: operadorHeaders
      })).status === 403,
      'Operador conseguiu excluir evento.'
    );
    verificar(
      (await requisitar(baseUrl, '/api/admin/eventos/' + eventoId, {
        method: 'DELETE', headers: adminHeaders
      })).status === 200,
      'Administrador não conseguiu excluir evento.'
    );
    const eventosDepoisDaExclusao = await requisitar(baseUrl, '/api/admin/eventos', {
      headers: adminHeaders
    });
    verificar(
      !eventosDepoisDaExclusao.corpo.eventos.some(function (item) {
        return item.id === eventoId;
      }),
      'Evento excluído continuou aparecendo no painel.'
    );
    verificar(
      Number((await banco.query(
        "SELECT COUNT(*) AS total FROM historico_eventos WHERE evento_id=$1 AND tipo_acao='exclusao'",
        [eventoId]
      )).rows[0].total) === 1,
      'Exclusão do evento não foi registrada no histórico.'
    );
    verificar(
      Number((await banco.query(
        'SELECT COUNT(*) AS total FROM contato_eventos WHERE evento_id=$1',
        [eventoId]
      )).rows[0].total) === totalInscricoesAntesExclusao,
      'Exclusão do evento removeu inscrições existentes.'
    );

    console.log('Eventos, permissões e exclusões: ' + total + ' verificações aprovadas.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) { servidor.close(resolver); });
    }
    await limparDadosTeste();
    if (idsEventosAtivosPreservados.length > 0) {
      await banco.query(
        "UPDATE eventos SET status = 'ativo' WHERE id = ANY($1::bigint[])",
        [idsEventosAtivosPreservados]
      );
    }
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
