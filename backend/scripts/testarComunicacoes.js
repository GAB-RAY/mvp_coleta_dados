require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const SENHA = 'TesteComunicacoes123!';
const EMAIL_ADMIN = 'comunicacoes.admin@invalid.local';
const EMAIL_OPERADOR = 'comunicacoes.operador@invalid.local';
const TELEFONES = ['21998887766', '21998887755', '21998887744'];
let total = 0;

function verificar(condicao, mensagem) {
  total += 1;
  assert.ok(condicao, mensagem);
}

async function requisitar(base, caminho, opcoes) {
  const resposta = await fetch(base + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  let corpo = {};

  if ((resposta.headers.get('content-type') || '').includes('application/json')) {
    corpo = await resposta.json();
  }

  return { status: resposta.status, corpo };
}

function criarCabecalhos(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
}

async function limpar() {
  await banco.query(`
    DELETE FROM comunicacoes
    WHERE operador_usuario_id IN (
      SELECT id FROM usuarios WHERE email = ANY($1::text[])
    )
  `, [[EMAIL_ADMIN, EMAIL_OPERADOR]]);
  await banco.query(`
    DELETE FROM modelos_mensagem
    WHERE criado_por_usuario_id IN (
      SELECT id FROM usuarios WHERE email = ANY($1::text[])
    )
  `, [[EMAIL_ADMIN, EMAIL_OPERADOR]]);
  await banco.query(`
    DELETE FROM campanhas
    WHERE criado_por_usuario_id IN (
      SELECT id FROM usuarios WHERE email = ANY($1::text[])
    )
  `, [[EMAIL_ADMIN, EMAIL_OPERADOR]]);
  await banco.query(`
    DELETE FROM numeros_whatsapp
    WHERE criado_por_usuario_id IN (
      SELECT id FROM usuarios WHERE email = ANY($1::text[])
    )
  `, [[EMAIL_ADMIN, EMAIL_OPERADOR]]);
  await banco.query(`
    DELETE FROM consentimentos
    WHERE contato_id IN (
      SELECT id FROM contatos WHERE telefone_normalizado = ANY($1::text[])
    )
  `, [TELEFONES]);
  await banco.query(
    'DELETE FROM contatos WHERE telefone_normalizado = ANY($1::text[])',
    [TELEFONES]
  );
  await banco.query(
    'DELETE FROM tentativas_login WHERE email_informado = ANY($1::text[])',
    [[EMAIL_ADMIN, EMAIL_OPERADOR]]
  );
  await banco.query(
    'DELETE FROM usuarios WHERE email = ANY($1::text[])',
    [[EMAIL_ADMIN, EMAIL_OPERADOR]]
  );
}

async function criarUsuario(nome, email, perfil, senhaHash) {
  const resultado = await banco.query(`
    INSERT INTO usuarios (nome, email, senha_hash, perfil)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [nome, email, senhaHash, perfil]);

  return resultado.rows[0];
}

async function criarContato(nome, telefone, origemId) {
  const resultado = await banco.query(`
    INSERT INTO contatos (
      nome, telefone, telefone_normalizado, bairro, problema,
      consentimento_armazenamento, consentimento_mensagens,
      consentimento_armazenamento_em, origem_id, status_contato
    )
    VALUES ($1, $2, $2, 'Bangu', 'Educação', TRUE, FALSE,
      CURRENT_TIMESTAMP, $3, 'ativo')
    RETURNING id
  `, [nome, telefone, origemId]);

  return resultado.rows[0];
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const senhaHash = await bcrypt.hash(SENHA, 4);
    await criarUsuario('Admin Comunicação', EMAIL_ADMIN, 'administrador', senhaHash);
    await criarUsuario('Operador Comunicação', EMAIL_OPERADOR, 'operador', senhaHash);
    const origem = await banco.query(
      "SELECT id FROM origens WHERE slug = 'formulario-publico'"
    );
    const contatoAutorizado = await criarContato(
      'Contato Autorizado',
      TELEFONES[0],
      origem.rows[0].id
    );
    const contatoSemResposta = await criarContato(
      'Contato Sem Resposta',
      TELEFONES[1],
      origem.rows[0].id
    );
    const contatoNaoInformado = await criarContato(
      'Contato Não Informado',
      TELEFONES[2],
      origem.rows[0].id
    );
    await banco.query(
      "UPDATE contatos SET bairro = NULL, problema = NULL, idade = NULL, status_contato = 'importado' WHERE id = $1",
      [contatoNaoInformado.id]
    );

    await banco.query(`
      INSERT INTO consentimentos (
        contato_id, contato_id_original, tipo, resposta, texto_apresentado,
        versao_texto, canal, origem_registro, estado, origem_id
      )
      VALUES ($1, $1, 'mensagens', TRUE, 'Texto de autorização para teste manual.',
        'teste', 'formulario_publico', 'resposta_expressa', 'autorizado', $2)
    `, [contatoAutorizado.id, origem.rows[0].id]);

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const base = 'http://127.0.0.1:' + servidor.address().port;

    async function login(email) {
      return requisitar(base, '/api/autenticacao/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha: SENHA })
      });
    }

    const loginAdmin = await login(EMAIL_ADMIN);
    const loginOperador = await login(EMAIL_OPERADOR);
    const cabecalhosAdmin = criarCabecalhos(loginAdmin.corpo.token);
    const cabecalhosOperador = criarCabecalhos(loginOperador.corpo.token);

    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/numeros')).status === 401,
      'Rota de números sem token não retornou 401.'
    );
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/numeros', {
        method: 'POST',
        headers: cabecalhosOperador,
        body: '{}'
      })).status === 403,
      'Operador cadastrou número da equipe.'
    );

    const numero = await requisitar(base, '/api/admin/comunicacoes/numeros', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'WhatsApp principal',
        numero: '21997776655',
        responsavel: 'Equipe',
        ativo: true
      })
    });
    verificar(numero.status === 201, 'Número da equipe não foi cadastrado.');
    const numeroTemporario = await requisitar(
      base,
      '/api/admin/comunicacoes/numeros',
      {
        method: 'POST',
        headers: cabecalhosAdmin,
        body: JSON.stringify({
          nome: 'WhatsApp temporário',
          numero: '21997776654',
          responsavel: 'Equipe',
          ativo: true
        })
      }
    );
    verificar(numeroTemporario.status === 201, 'Número temporário não foi cadastrado.');
    verificar(
      (await requisitar(
        base,
        '/api/admin/comunicacoes/numeros/' + numeroTemporario.corpo.numero.id,
        { method: 'DELETE', headers: cabecalhosOperador }
      )).status === 403,
      'Operador excluiu número da equipe.'
    );
    verificar(
      (await requisitar(
        base,
        '/api/admin/comunicacoes/numeros/' + numeroTemporario.corpo.numero.id,
        { method: 'DELETE', headers: cabecalhosAdmin }
      )).status === 200,
      'Administrador não excluiu número sem histórico.'
    );
    const numeroDuplicado = await requisitar(
      base,
      '/api/admin/comunicacoes/numeros',
      {
        method: 'POST',
        headers: cabecalhosAdmin,
        body: JSON.stringify({
          nome: 'WhatsApp duplicado',
          numero: '(21) 99777-6655',
          responsavel: 'Equipe',
          ativo: true
        })
      }
    );
    verificar(
      numeroDuplicado.status === 409 &&
        numeroDuplicado.corpo.mensagem.includes('já está cadastrado'),
      'Número duplicado não retornou uma orientação clara.'
    );

    const modelo = await requisitar(base, '/api/admin/comunicacoes/modelos', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Mensagem manual',
        categoria: 'Atendimento',
        texto: 'Olá, {{nome}}!'
      })
    });
    verificar(modelo.status === 201, 'Modelo não foi cadastrado.');

    const campanha = await requisitar(base, '/api/admin/comunicacoes/campanhas', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Campanha manual de teste',
        descricao: 'Segmentação sem disparo automático.'
      })
    });
    verificar(campanha.status === 201, 'Campanha não foi cadastrada.');
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/campanhas', {
        method: 'POST', headers: cabecalhosOperador, body: '{}'
      })).status === 403,
      'Operador cadastrou campanha.'
    );

    function dadosPreparo(contatoId) {
      return {
        contatoIds: [contatoId],
        modeloId: modelo.corpo.modelo.id,
        numeroId: numero.corpo.numero.id,
        campanhaId: campanha.corpo.campanha.id
      };
    }

    const preparoSemTextoPronto = dadosPreparo(contatoAutorizado.id);
    delete preparoSemTextoPronto.modeloId;
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/preparar', {
        method: 'POST',
        headers: cabecalhosOperador,
        body: JSON.stringify(preparoSemTextoPronto)
      })).status === 400,
      'Atendimento sem texto pronto foi aceito.'
    );

    const comunicacaoAutorizada = await requisitar(
      base,
      '/api/admin/comunicacoes/preparar',
      {
        method: 'POST',
        headers: cabecalhosOperador,
        body: JSON.stringify(dadosPreparo(contatoAutorizado.id))
      }
    );
    verificar(
      comunicacaoAutorizada.status === 201 &&
        comunicacaoAutorizada.corpo.comunicacoes[0].linkWhatsapp.includes('wa.me'),
      'Comunicação manual autorizada não foi preparada.'
    );
    verificar(
      (await requisitar(
        base,
        '/api/admin/comunicacoes/numeros/' + numero.corpo.numero.id,
        { method: 'DELETE', headers: cabecalhosAdmin }
      )).status === 409,
      'Número com histórico foi excluído e comprometeu a auditoria.'
    );
    verificar(
      comunicacaoAutorizada.corpo.comunicacoes[0].enviada_em === null,
      'Preparar comunicação marcou envio automaticamente.'
    );

    const comunicacaoSemResposta = await requisitar(
      base,
      '/api/admin/comunicacoes/preparar',
      {
        method: 'POST',
        headers: cabecalhosOperador,
        body: JSON.stringify(dadosPreparo(contatoSemResposta.id))
      }
    );
    verificar(
      comunicacaoSemResposta.status === 201,
      'Contato sem autorização informada não pôde receber atendimento manual.'
    );

    const comunicacaoAdmin = await requisitar(
      base,
      '/api/admin/comunicacoes/preparar',
      {
        method: 'POST',
        headers: cabecalhosAdmin,
        body: JSON.stringify(Object.assign(dadosPreparo(contatoNaoInformado.id), { campanhaId: null }))
      }
    );
    const comunicacaoAdminId = comunicacaoAdmin.corpo.comunicacoes[0].id;
    verificar(comunicacaoAdmin.status === 201, 'Administrador nao preparou mensagem para teste de permissao.');
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/' + comunicacaoAdminId + '/confirmar-envio', {
        method: 'POST',
        headers: cabecalhosOperador,
        body: '{}'
      })).status === 403,
      'Operador confirmou mensagem preparada por outro usuario.'
    );
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/' + comunicacaoAdminId, {
        method: 'DELETE', headers: cabecalhosAdmin
      })).status === 200,
      'Administrador nao cancelou a mensagem usada no teste de permissao.'
    );

    const comunicacaoCancelada = await requisitar(
      base,
      '/api/admin/comunicacoes/preparar',
      {
        method: 'POST',
        headers: cabecalhosOperador,
        body: JSON.stringify(Object.assign(dadosPreparo(contatoNaoInformado.id), { campanhaId: null }))
      }
    );
    const comunicacaoCanceladaId = comunicacaoCancelada.corpo.comunicacoes[0].id;
    verificar(comunicacaoCancelada.status === 201, 'Mensagem para cancelamento não foi preparada.');
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/' + comunicacaoCanceladaId, {
        method: 'DELETE', headers: cabecalhosOperador
      })).status === 200,
      'Operador não conseguiu cancelar a própria mensagem preparada.'
    );
    verificar(
      Number((await banco.query(
        'SELECT COUNT(*) AS total FROM comunicacoes WHERE id=$1',
        [comunicacaoCanceladaId]
      )).rows[0].total) === 0,
      'Mensagem cancelada permaneceu no banco.'
    );

    const bairroNaoInformado = await requisitar(
      base,
      '/api/admin/comunicacoes/contatos?bairro=' +
        encodeURIComponent('Não informado'),
      { headers: cabecalhosOperador }
    );
    verificar(
      bairroNaoInformado.status === 200 &&
        bairroNaoInformado.corpo.contatos.some(function (item) {
          return item.id === contatoNaoInformado.id;
        }),
      'Filtro de bairro não informado não encontrou o contato sem bairro.'
    );

    const problemaNaoInformado = await requisitar(
      base,
      '/api/admin/comunicacoes/contatos?problema=nao_informado&' +
        'consentimento=nao_informado&cadastroIncompleto=true',
      { headers: cabecalhosOperador }
    );
    verificar(
      problemaNaoInformado.status === 200 &&
        problemaNaoInformado.corpo.contatos.some(function (item) {
          return item.id === contatoNaoInformado.id;
        }),
      'Filtros combinados de dados não informados não encontraram o contato.'
    );

    const cadastroIncompleto = await requisitar(
      base,
      '/api/admin/comunicacoes/contatos?cadastroIncompleto=true',
      { headers: cabecalhosOperador }
    );
    verificar(
      cadastroIncompleto.status === 200 &&
        cadastroIncompleto.corpo.contatos.some(function (item) {
          return item.id === contatoNaoInformado.id;
        }),
      'Filtro de cadastro incompleto não encontrou o contato com dados vazios.'
    );

    const buscaPaginada = await requisitar(
      base,
      '/api/admin/comunicacoes/contatos?busca=' +
        encodeURIComponent('Contato Não Informado') + '&limite=1',
      { headers: cabecalhosOperador }
    );
    verificar(
      buscaPaginada.status === 200 &&
        buscaPaginada.corpo.contatos.length === 1 &&
        buscaPaginada.corpo.contatos[0].id === contatoNaoInformado.id &&
        buscaPaginada.corpo.paginacao.limite === 1 &&
        buscaPaginada.corpo.paginacao.totalRegistros >= 1,
      'Busca paginada de contatos para comunicação falhou.'
    );

    const limiteMaximo = await requisitar(
      base,
      '/api/admin/comunicacoes/contatos?limite=500',
      { headers: cabecalhosOperador }
    );
    verificar(
      limiteMaximo.status === 200 &&
        limiteMaximo.corpo.paginacao.limite === 100,
      'Limite máximo da paginação de contatos não foi aplicado.'
    );

    await banco.query(
      'UPDATE contatos SET bloqueado_para_mensagens = TRUE WHERE id = $1',
      [contatoSemResposta.id]
    );
    const comunicacaoBloqueada = await requisitar(
      base,
      '/api/admin/comunicacoes/preparar',
      {
        method: 'POST',
        headers: cabecalhosOperador,
        body: JSON.stringify(dadosPreparo(contatoSemResposta.id))
      }
    );
    verificar(
      comunicacaoBloqueada.status === 409,
      'Contato bloqueado pôde preparar mensagem.'
    );

    const comunicacaoId = comunicacaoAutorizada.corpo.comunicacoes[0].id;
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/' + comunicacaoId, {
        method: 'PATCH',
        headers: cabecalhosOperador,
        body: JSON.stringify({ status: 'enviada' })
      })).status === 400,
      'Atualização genérica marcou mensagem como enviada sem confirmação explícita.'
    );
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/' + comunicacaoId + '/confirmar-envio', {
        method: 'POST',
        headers: cabecalhosOperador,
        body: '{}'
      })).status === 200,
      'Envio manual não foi confirmado.'
    );
    verificar(
      (await requisitar(base, '/api/admin/comunicacoes/' + comunicacaoId, {
        method: 'DELETE', headers: cabecalhosOperador
      })).status === 409,
      'Mensagem já enviada pôde ser cancelada.'
    );
    const preparoLoteUm = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify(Object.assign(dadosPreparo(contatoNaoInformado.id), { campanhaId: null }))
    });
    const preparoLoteDois = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify(Object.assign(dadosPreparo(contatoNaoInformado.id), { campanhaId: null }))
    });
    verificar(
      preparoLoteUm.status === 201 && preparoLoteDois.status === 201,
      'Mensagens para confirmacao em lote nao foram preparadas.'
    );
    const confirmarLote = await requisitar(base, '/api/admin/comunicacoes/preparadas/confirmar-envio', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: '{}'
    });
    verificar(
      confirmarLote.status === 200 && confirmarLote.corpo.totalConfirmado >= 2,
      'Confirmacao em lote nao marcou preparos como enviados.'
    );
    const preparadasRestantesAdmin = await banco.query(
      `SELECT COUNT(*) AS total FROM comunicacoes
       WHERE operador_usuario_id = (SELECT id FROM usuarios WHERE email=$1)
         AND status = 'preparada'`,
      [EMAIL_ADMIN]
    );
    verificar(
      Number(preparadasRestantesAdmin.rows[0].total) === 0,
      'Confirmacao em lote deixou mensagens preparadas do admin pendentes.'
    );

    const preparoCancelamentoUm = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify(Object.assign(dadosPreparo(contatoNaoInformado.id), { campanhaId: null }))
    });
    const preparoCancelamentoDois = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify(Object.assign(dadosPreparo(contatoNaoInformado.id), { campanhaId: null }))
    });
    verificar(
      preparoCancelamentoUm.status === 201 && preparoCancelamentoDois.status === 201,
      'Mensagens para cancelamento em lote nao foram preparadas.'
    );
    const cancelarLote = await requisitar(base, '/api/admin/comunicacoes/preparadas', {
      method: 'DELETE',
      headers: cabecalhosAdmin
    });
    verificar(
      cancelarLote.status === 200 && cancelarLote.corpo.totalCancelado >= 2,
      'Cancelamento em lote nao removeu preparos pendentes.'
    );

    const contatosComMensagemEnviada = await requisitar(
      base,
      '/api/admin/contatos?statusAtendimento=enviada',
      { headers: cabecalhosOperador }
    );
    verificar(
      contatosComMensagemEnviada.status === 200 &&
        contatosComMensagemEnviada.corpo.contatos.some(function (item) {
          return item.id === contatoAutorizado.id &&
            item.statusAtendimento === 'enviada';
        }),
      'Tela de contatos não filtrou o atendimento com mensagem enviada.'
    );
    const contatosSemResposta = await requisitar(
      base,
      '/api/admin/contatos?statusAtendimento=nao_respondeu',
      { headers: cabecalhosOperador }
    );
    verificar(
      contatosSemResposta.status === 200 &&
        contatosSemResposta.corpo.contatos.some(function (item) {
          return item.id === contatoAutorizado.id;
        }),
      'Filtro consolidado de contatos que não responderam falhou.'
    );
    const duplicada = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosOperador,
      body: JSON.stringify(dadosPreparo(contatoAutorizado.id))
    });
    verificar(
      duplicada.status === 200 && duplicada.corpo.requerConfirmacao === true,
      'Campanha repetida não gerou alerta.'
    );
    const reenvioSemMotivo = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosOperador,
      body: JSON.stringify(Object.assign(
        dadosPreparo(contatoAutorizado.id),
        { confirmarReenvio: true }
      ))
    });
    verificar(reenvioSemMotivo.status === 400, 'Reenvio sem motivo foi aceito.');
    const reenvio = await requisitar(base, '/api/admin/comunicacoes/preparar', {
      method: 'POST',
      headers: cabecalhosOperador,
      body: JSON.stringify(Object.assign(
        dadosPreparo(contatoAutorizado.id),
        { confirmarReenvio: true, motivoReenvio: 'Solicitação da coordenação.' }
      ))
    });
    verificar(reenvio.status === 201, 'Reenvio justificado não foi preparado.');
    const historico = await requisitar(
      base,
      '/api/admin/comunicacoes?contatoId=' + contatoAutorizado.id,
      { headers: cabecalhosOperador }
    );
    verificar(
      historico.status === 200 &&
        historico.corpo.comunicacoes.length === 2 &&
        historico.corpo.comunicacoes.some(function (item) {
          return item.status === 'enviada';
        }),
      'Histórico não refletiu o envio.'
    );
    const eventosStatus = await requisitar(
      base,
      '/api/admin/comunicacoes/' + comunicacaoId + '/historico',
      { headers: cabecalhosOperador }
    );
    verificar(
      eventosStatus.status === 200 &&
        eventosStatus.corpo.historico.length === 2,
      'Auditoria de preparação e confirmação não foi registrada.'
    );
    const candidatos = await requisitar(
      base,
      '/api/admin/comunicacoes/contatos?campanhaNaoRecebidaId=' +
        campanha.corpo.campanha.id,
      { headers: cabecalhosOperador }
    );
    verificar(
      candidatos.status === 200 &&
        !candidatos.corpo.contatos.some(function (item) {
          return item.id === contatoAutorizado.id;
        }),
      'Filtro de campanha não excluiu contato que já recebeu a campanha.'
    );
    const comunicacaoRespondidaId = reenvio.corpo.comunicacoes[0].id;
    verificar(
      (await requisitar(
        base,
        '/api/admin/comunicacoes/' + comunicacaoRespondidaId,
        {
          method: 'PATCH',
          headers: cabecalhosOperador,
          body: JSON.stringify({ status: 'respondido' })
        }
      )).status === 200,
      'Andamento respondido não foi registrado.'
    );
    const contatosQueResponderam = await requisitar(
      base,
      '/api/admin/contatos?statusAtendimento=respondido',
      { headers: cabecalhosOperador }
    );
    verificar(
      contatosQueResponderam.status === 200 &&
        contatosQueResponderam.corpo.contatos.some(function (item) {
          return item.id === contatoAutorizado.id &&
            item.statusAtendimento === 'respondido';
        }),
      'Tela de contatos não filtrou quem respondeu.'
    );
    verificar(
      (await requisitar(
        base,
        '/api/admin/contatos?statusAtendimento=inexistente',
        { headers: cabecalhosOperador }
      )).status === 400,
      'Filtro de atendimento inválido foi aceito.'
    );

    console.log('Comunicação manual: ' + total + ' verificações aprovadas.');
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
