const eventoService = require('./eventoService');

async function listar(requisicao, resposta, proximo) {
  try {
    return resposta.status(200).json({
      mensagem: 'Eventos listados com sucesso.',
      eventos: await eventoService.listar()
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function criar(requisicao, resposta, proximo) {
  try {
    return resposta.status(201).json({
      mensagem: 'Evento criado com sucesso.',
      evento: await eventoService.criar(requisicao.body, requisicao.usuario)
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function editar(requisicao, resposta, proximo) {
  try {
    return resposta.status(200).json({
      mensagem: 'Evento atualizado com sucesso.',
      evento: await eventoService.editar(requisicao.params.id, requisicao.body, requisicao.usuario)
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function ativar(requisicao, resposta, proximo) {
  try {
    return resposta.status(200).json({
      mensagem: 'Evento ativado com sucesso.',
      evento: await eventoService.alterarStatus(requisicao.params.id, 'ativo', requisicao.usuario)
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function encerrar(requisicao, resposta, proximo) {
  try {
    return resposta.status(200).json({
      mensagem: 'Evento encerrado com sucesso.',
      evento: await eventoService.alterarStatus(requisicao.params.id, 'encerrado', requisicao.usuario)
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function listarParticipantes(requisicao,resposta,proximo){try{return resposta.status(200).json({mensagem:'Participantes listados com sucesso.',participantes:await eventoService.listarParticipantes(requisicao.params.id,requisicao.query)});}catch(erro){return proximo(erro);}}
async function atualizarStatusInscricao(requisicao,resposta,proximo){try{return resposta.status(200).json({mensagem:'Inscrição atualizada com sucesso.',inscricao:await eventoService.atualizarStatusInscricao(requisicao.params.id,requisicao.params.contatoId,requisicao.body.status)});}catch(erro){return proximo(erro);}}

module.exports = { ativar, atualizarStatusInscricao, criar, editar, encerrar, listar, listarParticipantes };
