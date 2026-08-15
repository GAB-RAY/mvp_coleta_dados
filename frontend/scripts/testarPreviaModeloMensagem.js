import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
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

assert.equal(substituirVariaveisPrevia('Mensagem simples', []), 'Mensagem simples');
assert.equal(substituirVariaveisPrevia('Olá, {{1}}!', [{ origem: 'nome_contato' }]), 'Olá, João!');
assert.equal(
  substituirVariaveisPrevia('{{1}} precisa de atenção em {{2}}.', [
    { origem: 'bairro' }, { origem: 'problema' }
  ]),
  'Copacabana precisa de atenção em Saneamento básico.'
);
assert.equal(substituirVariaveisPrevia('Olá, {{1}}!', []), 'Olá, {{1}}!');
assert.equal(valorExemploPrevia({ origem: 'fixo', valor: 'Encontro comunitário' }), 'Encontro comunitário');
assert.equal(valorExemploPrevia({ origem: 'fixo', valor: '' }), null);
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
assert.match(estilos, /\.editor-template-campanha[\s\S]*grid-template-columns/);
assert.match(estilos, /@media \(max-width: 1100px\)[\s\S]*\.editor-template-campanha[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(estilos, /@media \(max-width: 760px\)[\s\S]*\.previa-modelo-mensagem/);

console.log('Prévia visual de modelos: 19 verificações aprovadas.');
