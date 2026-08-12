const service = require('./mensageriaService');

async function enviar(req, res, next) {
  try {
    return res.status(200).json({
      mensagem: 'Mensagem aceita pela Meta com sucesso.',
      tentativa: await service.enviar(req.params.id)
    });
  } catch (erro) { return next(erro); }
}

async function reprocessar(req, res, next) {
  try {
    return res.status(201).json({
      mensagem: 'Nova tentativa criada com sucesso.',
      tentativa: await service.reprocessar(req.params.id)
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { enviar, reprocessar };
