const express = require('express');
const banco = require('../../config/banco');

const roteador = express.Router();

roteador.get('/saude/vivo', function (requisicao, resposta) {
  resposta.setHeader('Cache-Control', 'no-store');
  return resposta.status(200).json({
    mensagem: 'Aplicação em execução.'
  });
});

roteador.get('/saude/pronto', async function (requisicao, resposta) {
  resposta.setHeader('Cache-Control', 'no-store');

  try {
    await banco.query('SELECT 1');
    return resposta.status(200).json({
      mensagem: 'Aplicação pronta para receber tráfego.'
    });
  } catch (erro) {
    console.error('Erro na verificação de prontidão:', erro.message);
    return resposta.status(503).json({
      mensagem: 'Aplicação temporariamente indisponível.'
    });
  }
});

roteador.get('/teste', async function (requisicao, resposta) {
  resposta.setHeader('Cache-Control', 'no-store');
  try {
    await banco.query('SELECT 1');

    resposta.status(200).json({
      sucesso: true,
      mensagem: 'API e banco de dados conectados.'
    });
  } catch (erro) {
    console.error('Erro ao testar a conexão com o banco:', erro.message);

    resposta.status(500).json({
      sucesso: false,
      mensagem: 'Não foi possível conectar ao banco de dados.'
    });
  }
});

module.exports = roteador;
