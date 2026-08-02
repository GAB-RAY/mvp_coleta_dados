const eventoModel = require('./eventoModel');
const criarAppError = require('../../utils/AppError');

function texto(valor, nome, limite, obrigatorio) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (!obrigatorio) return null;
    throw criarAppError(nome + ' é obrigatório.', 400);
  }
  const tratado = String(valor).trim();
  if (tratado.length > limite) throw criarAppError(nome + ' deve ter no máximo ' + limite + ' caracteres.', 400);
  return tratado;
}

function dataHora(valor, nome, fimDoDia) {
  let valorData = valor;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    valorData = valor + (fimDoDia ? 'T23:59:59-03:00' : 'T00:00:00-03:00');
  }
  const data = new Date(valorData);
  if (typeof valor !== 'string' || Number.isNaN(data.getTime())) throw criarAppError(nome + ' é inválida.', 400);
  return data.toISOString();
}

function validarDados(recebidos) {
  const dados = recebidos || {};
  const dataInicial = dataHora(dados.dataInicial, 'Data e horário inicial');
  const dataFinal = dataHora(dados.dataFinal, 'Data e horário final', true);
  const inscricoesInicio = dataHora(dados.inscricoesInicio || dados.dataInicial, 'Início das inscrições');
  const inscricoesFim = dataHora(dados.inscricoesFim || dados.dataFinal, 'Fim das inscrições', true);
  if (dataFinal < dataInicial) throw criarAppError('O fim do evento não pode ser anterior ao início.', 400);
  if (inscricoesFim < inscricoesInicio) throw criarAppError('O fim das inscrições não pode ser anterior ao início.', 400);
  return {
    nome: texto(dados.nome, 'Nome', 150, true),
    descricao: texto(dados.descricao || dados.motivo, 'Descrição', 2000, true),
    local: texto(dados.local, 'Local', 500, false),
    link: texto(dados.link, 'Link', 1000, false),
    dataInicial, dataFinal, inscricoesInicio, inscricoesFim
  };
}

function transformar(evento) {
  return {
    id: evento.id, nome: evento.nome, descricao: evento.descricao || evento.motivo,
    motivo: evento.descricao || evento.motivo, dataInicial: evento.data_inicial,
    dataFinal: evento.data_final, local: evento.local_evento, link: evento.link_evento,
    inscricoesInicio: evento.inscricoes_inicio, inscricoesFim: evento.inscricoes_fim,
    status: evento.status, totalCadastros: evento.total_cadastros,
    criadoPor: evento.criado_por, atualizadoPor: evento.atualizado_por,
    criadoEm: evento.criado_em, atualizadoEm: evento.atualizado_em
  };
}

async function listar() { return (await eventoModel.listar()).map(transformar); }
async function criar(dados, usuario) { return transformar(await eventoModel.criar(validarDados(dados), usuario.id)); }
async function editar(idRecebido, dados, usuario) {
  const id = Number(idRecebido);
  if (!Number.isInteger(id) || id < 1) throw criarAppError('Identificador do evento inválido.', 400);
  const evento = await eventoModel.editar(id, validarDados(dados), usuario.id);
  if (!evento) throw criarAppError('Evento não encontrado.', 404);
  return transformar(evento);
}
async function alterarStatus(idRecebido, status, usuario) {
  const id = Number(idRecebido);
  if (!Number.isInteger(id) || id < 1) throw criarAppError('Identificador do evento inválido.', 400);
  try {
    const evento = await eventoModel.alterarStatus(id, status, usuario.id);
    if (!evento) throw criarAppError('Evento não encontrado.', 404);
    return transformar(evento);
  } catch (erro) {
    if (erro.codigoAplicacao === 'EVENTO_FORA_PERIODO') throw criarAppError(erro.message, 409);
    throw erro;
  }
}

async function listarParticipantes(idRecebido,filtrosRecebidos){
  const eventoId=Number(idRecebido);if(!Number.isInteger(eventoId)||eventoId<1)throw criarAppError('Identificador do evento inválido.',400);
  const filtros=filtrosRecebidos||{};return eventoModel.listarParticipantes(eventoId,{nome:typeof filtros.nome==='string'?filtros.nome.trim():null,telefone:typeof filtros.telefone==='string'?filtros.telefone.replace(/\D/g,''):null,statusInscricao:filtros.statusInscricao||null,statusMensagem:filtros.statusMensagem||null});
}
async function atualizarStatusInscricao(eventoIdRecebido,contatoIdRecebido,status){
  const eventoId=Number(eventoIdRecebido),contatoId=Number(contatoIdRecebido),permitidos=['inscrito','confirmado','presente','cancelado'];
  if(!Number.isInteger(eventoId)||eventoId<1||!Number.isInteger(contatoId)||contatoId<1)throw criarAppError('Identificador inválido.',400);
  if(!permitidos.includes(status))throw criarAppError('Status da inscrição inválido.',400);
  const vinculo=await eventoModel.atualizarStatusInscricao(eventoId,contatoId,status);if(!vinculo)throw criarAppError('Inscrição não encontrada.',404);return vinculo;
}

module.exports = { alterarStatus, atualizarStatusInscricao, criar, editar, listar, listarParticipantes };
