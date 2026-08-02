const service = require('./comunicacaoService');

async function executar(next, acao) {
  try {
    return await acao();
  } catch (erro) {
    return next(erro);
  }
}

function listarNumeros(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ numeros: await service.listarNumeros() });
  });
}
function criarNumero(req, res, next) {
  return executar(next, async function responder() {
    return res.status(201).json({
      mensagem: 'WhatsApp da equipe cadastrado com sucesso.',
      numero: await service.salvarNumero(null, req.body, req.usuario)
    });
  });
}
function editarNumero(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({
      mensagem: 'WhatsApp da equipe atualizado com sucesso.',
      numero: await service.salvarNumero(req.params.id, req.body, req.usuario)
    });
  });
}

function excluirNumero(req, res, next) {
  service.excluirNumero(req.params.id).then(function () {
    return res.status(200).json({
      mensagem: 'Número excluído com sucesso.'
    });
  }).catch(next);
}
function listarModelos(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ modelos: await service.listarModelos() });
  });
}
function criarModelo(req, res, next) {
  return executar(next, async function responder() {
    return res.status(201).json({
      mensagem: 'Template cadastrado com sucesso.',
      modelo: await service.salvarModelo(null, req.body, req.usuario)
    });
  });
}
function editarModelo(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({
      mensagem: 'Template atualizado com sucesso.',
      modelo: await service.salvarModelo(req.params.id, req.body, req.usuario)
    });
  });
}
function listarCampanhas(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ campanhas: await service.listarCampanhas() });
  });
}
function criarCampanha(req, res, next) {
  return executar(next, async function responder() {
    return res.status(201).json({
      mensagem: 'Campanha cadastrada com sucesso.',
      campanha: await service.salvarCampanha(null, req.body, req.usuario)
    });
  });
}
function editarCampanha(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({
      mensagem: 'Campanha atualizada com sucesso.',
      campanha: await service.salvarCampanha(req.params.id, req.body, req.usuario)
    });
  });
}
function listarOperadores(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ operadores: await service.listarOperadores() });
  });
}
function listarContatos(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ contatos: await service.listarContatos(req.query) });
  });
}
function preparar(req, res, next) {
  return executar(next, async function responder() {
    const resultado = await service.preparar(req.body, req.usuario);
    return res.status(resultado.requerConfirmacao ? 200 : 201).json(Object.assign({
      mensagem: resultado.requerConfirmacao
        ? 'Um ou mais contatos já receberam esta campanha. Confirme o reenvio e informe o motivo.'
        : 'Mensagem preparada. Abra o WhatsApp e confirme o envio somente depois de enviá-la manualmente.'
    }, resultado));
  });
}
function confirmarEnvio(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({
      mensagem: 'Envio manual confirmado com sucesso.',
      comunicacao: await service.confirmarEnvio(req.params.id, req.body, req.usuario)
    });
  });
}
function listar(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ comunicacoes: await service.listar(req.query) });
  });
}
function listarHistorico(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({ historico: await service.listarHistorico(req.params.id) });
  });
}
function atualizar(req, res, next) {
  return executar(next, async function responder() {
    return res.status(200).json({
      mensagem: 'Status do atendimento atualizado com sucesso.',
      comunicacao: await service.atualizar(req.params.id, req.body, req.usuario)
    });
  });
}

module.exports = {
  atualizar, confirmarEnvio, criarCampanha, criarModelo, criarNumero,
  editarCampanha, editarModelo, editarNumero, excluirNumero, listar, listarCampanhas,
  listarContatos, listarHistorico, listarModelos, listarNumeros,
  listarOperadores, preparar
};
