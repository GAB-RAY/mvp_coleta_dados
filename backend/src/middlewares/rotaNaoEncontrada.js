const criarAppError = require('../utils/AppError');

function rotaNaoEncontrada(requisicao, resposta, proximo) {
  return proximo(criarAppError('Rota não encontrada.', 404));
}

module.exports = rotaNaoEncontrada;
