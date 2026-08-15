import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolverImagemPrevia,
  substituirVariaveisPrevia,
  valorExemploPrevia
} from '../src/utils/previaModeloMensagem.js';

const diretorio = path.dirname(fileURLToPath(import.meta.url));
const pagina = fs.readFileSync(
  path.join(diretorio, '..', 'src', 'pages', 'CampanhasAdministrativas.jsx'),
  'utf8'
);
const estilos = fs.readFileSync(
  path.join(diretorio, '..', 'src', 'styles', 'administrativo.css'),
  'utf8'
);
const configuracaoVercel = fs.readFileSync(
  path.join(diretorio, '..', 'vercel.json'),
  'utf8'
);

assert.equal(substituirVariaveisPrevia('Mensagem simples', []), 'Mensagem simples');
assert.equal(substituirVariaveisPrevia('Olá, {{1}}!', [{ origem: 'nome_contato' }]), 'Olá, João!');
assert.equal(
  substituirVariaveisPrevia('{{1}} precisa de atenção em {{2}}.', [
    { origem: 'bairro' }, { origem: 'problema' }
  ]),
  'Copacabana precisa de atenção em Saneamento básico.'
);
assert.equal(substituirVariaveisPrevia('Olá, {{1}}!', []), 'Olá, {{1}}!');
assert.equal(
  substituirVariaveisPrevia('Olá, {{nome}}!', [{ origem: 'nome_contato' }]),
  'Olá, João!'
);
assert.equal(valorExemploPrevia({ origem: 'fixo', valor: 'Encontro comunitário' }), 'Encontro comunitário');
assert.equal(valorExemploPrevia({ origem: 'fixo', valor: '' }), null);
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'texto' }, ''), { estado: 'sem_cabecalho', endereco: '' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'dispositivo' }, ''), { estado: 'vazia', endereco: '' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'dispositivo' }, 'blob:imagem-local'), { estado: 'carregar', endereco: 'blob:imagem-local' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'dispositivo', imagemEnvio: 'media-id' }, ''), { estado: 'configurada', endereco: '' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'internet', imagemEnvio: '' }, ''), { estado: 'vazia', endereco: '' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'internet', imagemEnvio: 'arquivo.jpg' }, ''), { estado: 'invalida', endereco: '' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'internet', imagemEnvio: 'http://exemplo.com/imagem.jpg' }, ''), { estado: 'invalida', endereco: '' });
assert.deepEqual(resolverImagemPrevia({ cabecalhoTipo: 'imagem', imagemModo: 'internet', imagemEnvio: 'https://exemplo.com/imagem.jpg' }, ''), { estado: 'carregar', endereco: 'https://exemplo.com/imagem.jpg' });
assert.match(pagina, /Seu texto aparecerá aqui\./);
assert.match(pagina, /URL\.createObjectURL/);
assert.match(pagina, /URL\.revokeObjectURL/);
assert.match(pagina, /imagemModo==='internet'/);
assert.match(pagina, /Não foi possível carregar esta imagem/);
assert.match(pagina, /cabecalhoTipo==='texto'/);
assert.match(pagina, /template\.rodape/);
assert.match(pagina, /botaoTipo==='url'/);
assert.match(pagina, /botaoTipo==='optout'/);
assert.match(pagina, /Prévia ilustrativa/);
assert.match(pagina, /Sincronizado diretamente da conta oficial da Meta/);
assert.match(pagina, /Imagem para envio/);
assert.match(pagina, /Configurar imagem/);
assert.match(pagina, /imagemLocal\.arquivo===arquivoImagem/);
assert.match(pagina, /Imagem configurada para envio/);
assert.match(pagina, /removerImagemEnvio/);
assert.match(pagina, /Remover imagem configurada/);
assert.match(pagina, /Não foi possível salvar as informações de envio/);
assert.match(pagina, /parameter_format/);
assert.match(pagina, /Escolha uma informação/);
assert.match(configuracaoVercel, /img-src 'self' data: blob: https:/);
assert.match(estilos, /\.editor-template-campanha[\s\S]*grid-template-columns/);
assert.match(estilos, /@media \(max-width: 1100px\)[\s\S]*\.editor-template-campanha[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(estilos, /@media \(max-width: 760px\)[\s\S]*\.previa-modelo-mensagem/);

console.log('Prévia visual de modelos: 39 verificações aprovadas.');
