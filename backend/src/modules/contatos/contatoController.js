const contatoService = require('./contatoService');

async function cadastrar(requisicao, resposta, proximo) {
  try {
    await contatoService.cadastrarContato(requisicao.body);

    return resposta.status(201).json({
      mensagem: 'Cadastro realizado com sucesso. Obrigado por contribuir com o projeto A Voz do Bairro.'
    });
  } catch (erro) {
    return proximo(erro);
  }
}

function listarOpcoes(requisicao, resposta) {
  const opcoes = contatoService.listarOpcoesFormulario();

  return resposta.status(200).json({
    categoriasProblema: opcoes.categoriasProblema
  });
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

module.exports = {
  cadastrar,
  listar,
  listarOpcoes,
  detalhar,
  cadastrarManual
};
