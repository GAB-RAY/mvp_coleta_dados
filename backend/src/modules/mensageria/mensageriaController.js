const service = require('./mensageriaService');

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

module.exports = { reprocessar };
