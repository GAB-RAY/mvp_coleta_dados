require('dotenv').config({ quiet: true });

const aplicacao = require('./app');

const porta = Number(process.env.PORTA) || 3000;

aplicacao.listen(porta, function () {
  console.log('Servidor iniciado na porta ' + porta + '.');
});
