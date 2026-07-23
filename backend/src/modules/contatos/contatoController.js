const contatoService = require('./contatoService');

async function cadastrar(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.cadastrarContato(requisicao.body);

    return resposta.status(201).json({
      mensagem: 'Cadastro realizado com sucesso. Obrigado por contribuir com o projeto A Voz do Bairro.',
      evento: resultado.eventoAtivo
        ? { id: resultado.eventoAtivo.id, nome: resultado.eventoAtivo.nome }
        : null,
      contextoCadastro: resultado.eventoAtivo
        ? 'Cadastro vinculado ao evento ' + resultado.eventoAtivo.nome + '.'
        : 'Cadastro geral do projeto A Voz do Bairro, sem vínculo com evento.'
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function listarOpcoes(requisicao, resposta, proximo) {
  try {
    const opcoes = await contatoService.listarOpcoesFormulario();

    return resposta.status(200).json({
      bairros: opcoes.bairros,
      categoriasProblema: opcoes.categoriasProblema,
      eventoAtivo: opcoes.eventoAtivo,
      contextoCadastro: opcoes.contextoCadastro
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function listar(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.listarContatos(requisicao.query);

    return resposta.status(200).json({
      mensagem: 'Contatos listados com sucesso.',
      contatos: resultado.contatos,
      paginacao: resultado.paginacao
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function detalhar(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.detalharContato(requisicao.params.id);

    return resposta.status(200).json({
      mensagem: 'Contato detalhado com sucesso.',
      contato: resultado.contato,
      consentimentos: resultado.consentimentos,
      aceitesPrivacidade: resultado.aceitesPrivacidade,
      historico: resultado.historico
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function cadastrarManual(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.cadastrarContatoManual(
      requisicao.body,
      requisicao.usuario
    );

    return resposta.status(resultado.contatoCriado ? 201 : 200).json({
      mensagem: resultado.contatoCriado
        ? 'Contato cadastrado manualmente com sucesso.'
        : 'Contato existente atualizado com histórico.',
      contatoId: resultado.id,
      contatoCriado: resultado.contatoCriado,
      camposAlterados: resultado.camposAlterados
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function revogarConsentimentos(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.revogarConsentimentos(
      requisicao.params.id,
      requisicao.body,
      requisicao.usuario
    );

    return resposta.status(200).json({
      mensagem: resultado.alterado
        ? 'Revogação de consentimentos registrada com sucesso.'
        : 'Os bloqueios solicitados já estavam registrados.',
      alterado: resultado.alterado,
      tiposRevogados: resultado.tiposRevogados,
      bloqueadoParaMensagens: resultado.bloqueadoParaMensagens,
      bloqueadoParaLigacoes: resultado.bloqueadoParaLigacoes
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function solicitarExclusao(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.solicitarExclusao(
      requisicao.params.id,
      requisicao.body,
      requisicao.usuario
    );

    return resposta.status(200).json({
      mensagem: resultado.alterado
        ? 'Solicitação de exclusão registrada com sucesso.'
        : 'A solicitação de exclusão já estava registrada.',
      alterado: resultado.alterado,
      solicitacaoId: resultado.id,
      solicitadaEm: resultado.solicitadaEm,
      solicitadaPorUsuarioId: resultado.solicitadaPorUsuarioId
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  cadastrar,
  listar,
  listarOpcoes,
  detalhar,
  cadastrarManual,
  revogarConsentimentos,
  solicitarExclusao
};
