const contatoService = require('./contatoService');

async function cadastrar(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.cadastrarContato(requisicao.body);
    let statusHttp = 201;
    let mensagem = 'Cadastro realizado com sucesso. Obrigado por contribuir com o projeto Acorda RJ.';

    if (resultado.eventoAtivo && !resultado.contatoCriado) {
      statusHttp = 200;
      mensagem = resultado.vinculoEventoCriado
        ? 'Inscrição no evento realizada com sucesso.'
        : 'Sua inscrição neste evento já está registrada.';
    }

    return resposta.status(statusHttp).json({
      mensagem,
      evento: resultado.eventoAtivo
        ? { id: resultado.eventoAtivo.id, nome: resultado.eventoAtivo.nome }
        : null,
      contextoCadastro: resultado.eventoAtivo
        ? 'Cadastro vinculado ao evento ' + resultado.eventoAtivo.nome + '.'
        : null,
      contatoCriado: resultado.contatoCriado,
      inscricaoEventoCriada: resultado.eventoAtivo
        ? resultado.vinculoEventoCriado
        : false,
      jaInscritoEvento: Boolean(
        resultado.eventoAtivo &&
        !resultado.contatoCriado &&
        !resultado.vinculoEventoCriado
      )
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function listarOpcoes(requisicao, resposta, proximo) {
  try {
    const opcoes = await contatoService.listarOpcoesFormulario(requisicao.query.eventoId);

    resposta.setHeader(
      'Cache-Control',
      requisicao.query.eventoId
        ? 'no-store'
        : 'public, max-age=30, stale-while-revalidate=60'
    );
    return resposta.status(200).json({
      bairros: opcoes.bairros,
      categoriasProblema: opcoes.categoriasProblema,
      textosConsentimento: opcoes.textosConsentimento,
      eventoAtivo: opcoes.eventoAtivo,
      contextoCadastro: opcoes.contextoCadastro
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function verificarContatoEvento(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.verificarContatoEvento(requisicao.body);
    let mensagem = 'Preencha os demais campos para concluir seu cadastro no evento.';

    if (resultado.situacao === 'contato_encontrado') {
      mensagem = 'Cadastro confirmado. Você pode concluir sua participação no evento.';
    }

    if (resultado.situacao === 'ja_inscrito') {
      mensagem = 'Sua inscrição neste evento já está registrada.';
    }

    return resposta.status(200).json({
      mensagem,
      situacao: resultado.situacao,
      evento: {
        id: resultado.eventoAtivo.id,
        nome: resultado.eventoAtivo.nome
      }
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function inscreverContatoExistenteEvento(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.inscreverContatoExistenteEvento(
      requisicao.body
    );

    return resposta.status(200).json({
      mensagem: resultado.vinculoEventoCriado
        ? 'Inscrição no evento realizada com sucesso.'
        : 'Sua inscrição neste evento já está registrada.',
      evento: {
        id: resultado.eventoAtivo.id,
        nome: resultado.eventoAtivo.nome
      },
      inscricaoEventoCriada: resultado.vinculoEventoCriado,
      jaInscritoEvento: !resultado.vinculoEventoCriado
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
      historico: resultado.historico,
      comunicacoes: resultado.comunicacoes
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
  inscreverContatoExistenteEvento,
  listar,
  listarOpcoes,
  detalhar,
  cadastrarManual,
  revogarConsentimentos,
  solicitarExclusao,
  verificarContatoEvento
};
