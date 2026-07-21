const express = require('express');
const banco = require('../../config/banco');

const roteador = express.Router();

roteador.get('/teste', async function (requisicao, resposta) {
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
