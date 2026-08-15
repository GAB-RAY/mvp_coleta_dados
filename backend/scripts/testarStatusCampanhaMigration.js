require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const pg = require('pg');

const NOME_BANCO = 'acorda_rj_status_campanha_qa_' + process.pid;

function configuracao(nomeBanco) {
  if (process.env.DATABASE_URL) {
    const endereco = new URL(process.env.DATABASE_URL);
    endereco.pathname = '/' + nomeBanco;
    return { connectionString: endereco.toString() };
  }
  return {
    host: process.env.BANCO_HOST,
    port: Number(process.env.BANCO_PORTA) || 5432,
    user: process.env.BANCO_USUARIO,
    password: process.env.BANCO_SENHA,
    database: nomeBanco,
    ssl: process.env.BANCO_SSL === 'true'
  };
}

function urlBanco(nomeBanco) {
  if (process.env.DATABASE_URL) {
    const endereco = new URL(process.env.DATABASE_URL);
    endereco.pathname = '/' + nomeBanco;
    return endereco.toString();
  }
  return 'postgresql://' + encodeURIComponent(process.env.BANCO_USUARIO || '') + ':' +
    encodeURIComponent(process.env.BANCO_SENHA || '') + '@' +
    (process.env.BANCO_HOST || '127.0.0.1') + ':' + (process.env.BANCO_PORTA || '5432') +
    '/' + nomeBanco + (process.env.BANCO_SSL === 'true' ? '?sslmode=require' : '');
}

async function removerBanco(cliente) {
  await cliente.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [NOME_BANCO]);
  await cliente.query('DROP DATABASE IF EXISTS "' + NOME_BANCO + '"');
}

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

async function executar() {
  const administracao = new pg.Client(configuracao('postgres'));
  let bancoTeste;
  let bancoAplicacao;
  let administracaoConectada = false;
  try {
    await administracao.connect();
    administracaoConectada = true;
    await removerBanco(administracao);
    await administracao.query('CREATE DATABASE "' + NOME_BANCO + '"');

    bancoTeste = new pg.Client(configuracao(NOME_BANCO));
    await bancoTeste.connect();
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'criar_banco.sql'), 'utf8');
    await bancoTeste.query(schema);

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = urlBanco(NOME_BANCO);
    const campanhaService = require('../src/modules/campanhas/campanhaService');
    bancoAplicacao = require('../src/config/banco');

    const usuario = (await bancoAplicacao.query(`
      INSERT INTO usuarios (nome,email,senha_hash,perfil,ativo)
      VALUES ('QA Status Campanha','qa.status.campanha@invalid.local','hash-qa','administrador',TRUE)
      RETURNING id,nome,email,perfil
    `)).rows[0];
    const modelo = await campanhaService.salvarTemplate(null, {
      nome: 'QA Status Campanha', categoria: 'Geral', conteudo: 'Mensagem QA', ativo: true,
      metaNome: 'qa_status_campanha', metaIdioma: 'pt_BR', metaCategoria: 'MARKETING',
      componentes: [{ type: 'BODY', text: 'Mensagem QA' }],
      configuracaoEnvio: { corpo: [], botoes: [] }
    }, usuario);
    const campanha = await campanhaService.criar({
      nome: 'QA Regressao 23514', finalidade: 'Regressao da constraint de status.',
      modeloId: modelo.id, filtros: {}
    }, usuario);
    const campanhaLegada = await campanhaService.criar({
      nome: 'QA Status Agendada', finalidade: 'Conversao do estado historico.',
      modeloId: modelo.id, filtros: {}
    }, usuario);
    confirmar(campanha.status === 'rascunho', 'O status inicial deve ser rascunho.');

    await bancoAplicacao.query(`
      ALTER TABLE campanhas
        DROP CONSTRAINT IF EXISTS campanhas_status_valido,
        DROP CONSTRAINT IF EXISTS campanhas_status_novo_valido
    `);
    await bancoAplicacao.query(`
      ALTER TABLE campanhas ADD CONSTRAINT campanhas_status_valido CHECK (
        status IN ('rascunho','agendada','ativa','pausada','concluida','cancelada')
      )
    `);
    await bancoAplicacao.query("UPDATE campanhas SET status='agendada' WHERE id=$1", [campanhaLegada.id]);

    let erroReproduzido;
    try {
      await campanhaService.alterarStatus(campanha.id, 'pronta', usuario);
    } catch (erro) { erroReproduzido = erro; }
    confirmar(erroReproduzido && erroReproduzido.code === '23514' &&
      erroReproduzido.constraint === 'campanhas_status_valido',
    'A transicao rascunho -> pronta deve reproduzir o 23514 da constraint antiga.');
    const aposFalha = await campanhaService.listar();
    confirmar(aposFalha.find(function (item) { return item.id === campanha.id; }).status === 'rascunho',
      'A falha deve preservar o status anterior rascunho.');

    const migration = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'migrations', '016_alinhar_status_campanhas.sql'),
      'utf8'
    );
    await bancoAplicacao.query(migration);

    const atualizado = await campanhaService.alterarStatus(campanha.id, 'pronta', usuario);
    confirmar(atualizado.status === 'pronta',
      'A mesma transicao deve concluir depois da migration.');
    const legadoAtualizado = (await bancoAplicacao.query(
      'SELECT status,pronta_em FROM campanhas WHERE id=$1', [campanhaLegada.id]
    )).rows[0];
    confirmar(legadoAtualizado.status === 'pronta' && Boolean(legadoAtualizado.pronta_em),
      'O status historico agendada deve ser convertido para pronta sem perder a campanha.');

    const constraints = (await bancoAplicacao.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definicao
      FROM pg_constraint
      WHERE conrelid='public.campanhas'::regclass AND contype='c'
        AND conname LIKE 'campanhas_status%'
    `)).rows;
    confirmar(constraints.length === 1 && constraints[0].conname === 'campanhas_status_valido' &&
      constraints[0].definicao.includes("'pronta'") && !constraints[0].definicao.includes("'agendada'"),
    'Deve restar uma unica constraint com os seis estados oficiais.');

    let invalidoRejeitado;
    try { await bancoAplicacao.query("UPDATE campanhas SET status='qualquer' WHERE id=$1", [campanha.id]); }
    catch (erro) { invalidoRejeitado = erro; }
    confirmar(invalidoRejeitado && invalidoRejeitado.code === '23514',
      'A constraint deve continuar rejeitando status desconhecido.');

    console.log('Regressao campanhas_status_valido: rascunho -> pronta aprovada; 23514 corrigido.');
  } finally {
    if (bancoAplicacao) await bancoAplicacao.end().catch(function () {});
    if (bancoTeste) await bancoTeste.end().catch(function () {});
    if (administracaoConectada) {
      await removerBanco(administracao).catch(function () {});
      await administracao.end().catch(function () {});
    }
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
