require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const EMAIL_TESTE = 'privacidade.operador@invalid.local';
const TELEFONE_TESTE = '21999987007';
const SENHA_TESTE = 'SenhaPrivacidade123!';
let totalVerificacoes = 0;

function verificar(condicao, mensagem) {
  totalVerificacoes += 1;

  if (!condicao) {
    throw new Error(mensagem);
  }
}

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  const corpo = await resposta.json();

  return { status: resposta.status, corpo };
}

async function limpar() {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const resultadoContato = await cliente.query(
      'SELECT id FROM contatos WHERE telefone_normalizado = $1',
      [TELEFONE_TESTE]
    );

    if (resultadoContato.rows[0]) {
      const contatoId = resultadoContato.rows[0].id;
      await cliente.query('DELETE FROM aceites_privacidade WHERE contato_id = $1', [contatoId]);
      await cliente.query('DELETE FROM consentimentos WHERE contato_id = $1', [contatoId]);
      await cliente.query('DELETE FROM historico_contatos WHERE contato_id = $1', [contatoId]);
      await cliente.query('DELETE FROM contatos WHERE id = $1', [contatoId]);
    }

    await cliente.query('DELETE FROM tentativas_login WHERE email_informado = $1', [EMAIL_TESTE]);
    await cliente.query('DELETE FROM usuarios WHERE email = $1', [EMAIL_TESTE]);
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

function dadosCadastroPublico() {
  return {
    nome: 'Contato Privacidade Teste',
    telefone: TELEFONE_TESTE,
    idade: 38,
    bairro: 'Vila Kennedy',
    problema: 'Saúde',
    aceitePrivacidade: true,
    autorizacaoMensagens: true,
    autorizacaoLigacoes: true
  };
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const senhaHash = await bcrypt.hash(SENHA_TESTE, 4);
    await banco.query(
      `
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES ($1, $2, $3, 'operador')
      `,
      ['Operador Privacidade', EMAIL_TESTE, senhaHash]
    );

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;

    const cadastro = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify(dadosCadastroPublico())
    });
    verificar(cadastro.status === 201, 'O contato temporário não foi criado.');

    const login = await requisitar(baseUrl, '/api/autenticacao/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL_TESTE, senha: SENHA_TESTE })
    });
    verificar(login.status === 200, 'O login temporário falhou.');
    verificar(Boolean(login.corpo.token), 'O login não retornou JWT.');
    const cabecalhos = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + login.corpo.token
    };
    const listagem = await requisitar(
      baseUrl,
      '/api/admin/contatos?telefone=' + TELEFONE_TESTE,
      { headers: cabecalhos }
    );
    verificar(listagem.status === 200, 'A listagem do contato temporário falhou.');
    verificar(listagem.corpo.contatos.length === 1, 'O contato temporário não foi localizado.');
    const contatoId = listagem.corpo.contatos[0].id;

    verificar((await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      { method: 'POST', body: JSON.stringify({ tipo: 'mensagens' }) }
    )).status === 401, 'A revogação sem token não retornou 401.');
    verificar((await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao',
      { method: 'POST' }
    )).status === 401, 'A solicitação de exclusão sem token não retornou 401.');
    verificar((await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ tipo: 'email' })
      }
    )).status === 400, 'O tipo inválido de revogação não retornou 400.');
    verificar((await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ tipo: 'mensagens', motivo: 'x'.repeat(501) })
      }
    )).status === 400, 'O motivo acima de 500 caracteres não retornou 400.');

    const revogacaoMensagens = await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({
          tipo: 'mensagens',
          motivo: 'Solicitação feita pela própria pessoa.'
        })
      }
    );
    verificar(revogacaoMensagens.status === 200, 'A revogação de mensagens falhou.');
    verificar(revogacaoMensagens.corpo.alterado === true, 'A revogação não informou alteração.');
    verificar(
      revogacaoMensagens.corpo.tiposRevogados.includes('mensagens'),
      'Mensagens não apareceram entre os tipos revogados.'
    );

    const estadoMensagens = await banco.query(
      `
        SELECT
          contato.bloqueado_para_mensagens,
          contato.bloqueado_para_ligacoes,
          consentimento.estado,
          consentimento.registrado_por_usuario_id,
          consentimento.criado_em,
          consentimento.motivo_revogacao
        FROM contatos AS contato
        JOIN consentimentos AS consentimento
          ON consentimento.contato_id = contato.id
         AND consentimento.tipo = 'mensagens'
         AND consentimento.ativo = TRUE
        WHERE contato.id = $1
      `,
      [contatoId]
    );
    verificar(estadoMensagens.rows[0].bloqueado_para_mensagens === true, 'Mensagens não foram bloqueadas.');
    verificar(estadoMensagens.rows[0].bloqueado_para_ligacoes === false, 'Ligações foram bloqueadas indevidamente.');
    verificar(estadoMensagens.rows[0].estado === 'revogado', 'O estado revogado não foi registrado.');
    verificar(Boolean(estadoMensagens.rows[0].registrado_por_usuario_id), 'O responsável não foi registrado.');
    verificar(Boolean(estadoMensagens.rows[0].criado_em), 'A data e a hora da revogação não foram registradas.');
    verificar(
      estadoMensagens.rows[0].motivo_revogacao === 'Solicitação feita pela própria pessoa.',
      'O motivo opcional não foi registrado.'
    );

    const contagensAntesRepeticao = await banco.query(
      `
        SELECT
          (SELECT COUNT(*)::integer FROM consentimentos WHERE contato_id = $1) AS consentimentos,
          (SELECT COUNT(*)::integer FROM historico_contatos WHERE contato_id = $1) AS historicos
      `,
      [contatoId]
    );
    const revogacaoRepetida = await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({
          tipo: 'mensagens',
          motivo: 'Solicitação feita pela própria pessoa.'
        })
      }
    );
    verificar(revogacaoRepetida.status === 200, 'A revogação idempotente falhou.');
    verificar(revogacaoRepetida.corpo.alterado === false, 'A repetição criou uma alteração indevida.');
    const contagensDepoisRepeticao = await banco.query(
      `
        SELECT
          (SELECT COUNT(*)::integer FROM consentimentos WHERE contato_id = $1) AS consentimentos,
          (SELECT COUNT(*)::integer FROM historico_contatos WHERE contato_id = $1) AS historicos
      `,
      [contatoId]
    );
    verificar(
      contagensDepoisRepeticao.rows[0].consentimentos === contagensAntesRepeticao.rows[0].consentimentos,
      'A revogação repetida duplicou consentimentos.'
    );
    verificar(
      contagensDepoisRepeticao.rows[0].historicos === contagensAntesRepeticao.rows[0].historicos,
      'A revogação repetida duplicou o histórico.'
    );

    const revogacaoLigacoes = await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ tipo: 'ligacoes' })
      }
    );
    verificar(revogacaoLigacoes.status === 200, 'A revogação de ligações falhou.');
    verificar(revogacaoLigacoes.corpo.bloqueadoParaLigacoes === true, 'Ligações não foram bloqueadas.');

    const novaAutorizacao = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify(dadosCadastroPublico())
    });
    verificar(novaAutorizacao.status === 201, 'A nova resposta expressa não foi aceita.');
    const estadoReautorizado = await banco.query(
      `
        SELECT bloqueado_para_mensagens, bloqueado_para_ligacoes
        FROM contatos
        WHERE id = $1
      `,
      [contatoId]
    );
    verificar(estadoReautorizado.rows[0].bloqueado_para_mensagens === false, 'A autorização expressa não liberou mensagens.');
    verificar(estadoReautorizado.rows[0].bloqueado_para_ligacoes === false, 'A autorização expressa não liberou ligações.');

    const revogacaoAmbos = await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/revogar-consentimentos',
      {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ tipo: 'ambos' })
      }
    );
    verificar(revogacaoAmbos.status === 200, 'A revogação de ambos falhou.');
    verificar(revogacaoAmbos.corpo.tiposRevogados.length === 2, 'Ambos os consentimentos não foram revogados.');

    const solicitacao = await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao',
      { method: 'POST', headers: cabecalhos }
    );
    verificar(solicitacao.status === 200, 'A solicitação de exclusão falhou.');
    verificar(solicitacao.corpo.alterado === true, 'A solicitação não informou alteração.');
    verificar(Boolean(solicitacao.corpo.solicitadaEm), 'A solicitação não retornou data e hora.');

    const estadoExclusao = await banco.query(
      `
        SELECT
          bloqueado_para_mensagens,
          bloqueado_para_ligacoes,
          bloqueado_para_campanhas,
          exclusao_solicitada_em,
          exclusao_solicitada_por_usuario_id,
          excluido_logicamente
        FROM contatos
        WHERE id = $1
      `,
      [contatoId]
    );
    const contatoBloqueado = estadoExclusao.rows[0];
    verificar(contatoBloqueado.bloqueado_para_mensagens === true, 'Mensagens não ficaram bloqueadas após a solicitação.');
    verificar(contatoBloqueado.bloqueado_para_ligacoes === true, 'Ligações não ficaram bloqueadas após a solicitação.');
    verificar(contatoBloqueado.bloqueado_para_campanhas === true, 'Campanhas não ficaram bloqueadas após a solicitação.');
    verificar(Boolean(contatoBloqueado.exclusao_solicitada_em), 'A data da solicitação não foi persistida.');
    verificar(Boolean(contatoBloqueado.exclusao_solicitada_por_usuario_id), 'O responsável pela solicitação não foi persistido.');
    verificar(contatoBloqueado.excluido_logicamente === false, 'O contato foi excluído indevidamente.');

    const historicoExclusao = await banco.query(
      `
        SELECT registrado_por_usuario_id, criado_em
        FROM historico_contatos
        WHERE contato_id = $1
          AND tipo_evento = 'solicitacao_exclusao'
      `,
      [contatoId]
    );
    verificar(historicoExclusao.rows.length === 1, 'O histórico da solicitação não foi criado uma única vez.');
    verificar(Boolean(historicoExclusao.rows[0].registrado_por_usuario_id), 'O histórico não guardou o responsável.');
    verificar(Boolean(historicoExclusao.rows[0].criado_em), 'O histórico não guardou data e hora.');

    const solicitacaoRepetida = await requisitar(
      baseUrl,
      '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao',
      { method: 'POST', headers: cabecalhos }
    );
    verificar(solicitacaoRepetida.status === 200, 'A repetição da solicitação falhou.');
    verificar(solicitacaoRepetida.corpo.alterado === false, 'A repetição da solicitação alterou o cadastro.');
    const totalHistoricosExclusao = await banco.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM historico_contatos
        WHERE contato_id = $1
          AND tipo_evento = 'solicitacao_exclusao'
      `,
      [contatoId]
    );
    verificar(totalHistoricosExclusao.rows[0].total === 1, 'A solicitação repetida duplicou o histórico.');

    await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify(dadosCadastroPublico())
    });
    const bloqueioDepoisDeNovaResposta = await banco.query(
      `
        SELECT
          bloqueado_para_mensagens,
          bloqueado_para_ligacoes,
          bloqueado_para_campanhas
        FROM contatos
        WHERE id = $1
      `,
      [contatoId]
    );
    verificar(
      bloqueioDepoisDeNovaResposta.rows[0].bloqueado_para_mensagens === true &&
      bloqueioDepoisDeNovaResposta.rows[0].bloqueado_para_ligacoes === true &&
      bloqueioDepoisDeNovaResposta.rows[0].bloqueado_para_campanhas === true,
      'Uma nova resposta removeu o bloqueio da solicitação de exclusão.'
    );

    const detalhes = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId, {
      headers: cabecalhos
    });
    verificar(detalhes.status === 200, 'Os detalhes após as ações falharam.');
    verificar(detalhes.corpo.contato.bloqueadoParaCampanhas === true, 'Os detalhes não expõem o bloqueio de campanhas.');
    verificar(Boolean(detalhes.corpo.contato.exclusaoSolicitadaPor), 'Os detalhes não expõem o responsável pela solicitação.');
    verificar(
      detalhes.corpo.consentimentos.some(function (item) {
        return item.motivoRevogacao === 'Solicitação feita pela própria pessoa.' &&
          item.registradoPor === 'Operador Privacidade';
      }),
      'Os detalhes não exibem motivo e operador responsável pela revogação.'
    );
    verificar(
      detalhes.corpo.historico.some(function (item) {
        return item.tipoEvento === 'solicitacao_exclusao' && Boolean(item.usuario);
      }),
      'Os detalhes não exibem o responsável no histórico.'
    );

    console.log('Privacidade administrativa: ' + totalVerificacoes + ' verificações aprovadas.');
    console.log('Revogações, idempotência, responsáveis, datas e bloqueio de campanhas aprovados.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) {
        servidor.close(resolver);
      });
    }

    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
