import formatarTelefone from '../utils/formatarTelefone';
import { Link } from 'react-router-dom';

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
});

function formatarData(dataRecebida) {
  if (!dataRecebida) {
    return '—';
  }

  const data = new Date(dataRecebida);

  if (Number.isNaN(data.getTime())) {
    return '—';
  }

  return formatadorData.format(data);
}

function obterConsentimento(valor) {
  if (valor === true || valor === 'autorizado') {
    return {
      texto: 'Sim',
      classe: 'consentimento-sim'
    };
  }

  if (valor === false || valor === 'recusado' || valor === 'revogado') {
    return {
      texto: valor === 'revogado' ? 'Revogado' : 'Recusado',
      classe: 'consentimento-nao'
    };
  }

  return {
    texto: 'Não informado',
    classe: 'consentimento-nao-informado'
  };
}

function exibirConsentimento(valor) {
  const consentimento = obterConsentimento(valor);

  return (
    <span className={'badge-consentimento ' + consentimento.classe}>
      {consentimento.texto}
    </span>
  );
}

function exibirTextoOuNaoInformado(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    return 'Não informado';
  }

  return valor;
}

function TabelaContatos(propriedades) {
  return (
    <div className="tabela-responsiva" tabIndex="0" aria-label="Tabela de contatos cadastrados">
      <table className="tabela-contatos">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Telefone</th>
            <th scope="col">Idade</th>
            <th scope="col">Bairro</th>
            <th scope="col">Principal problema</th>
            <th scope="col">Mensagens</th>
            <th scope="col">Ligações</th>
            <th scope="col">Origem</th>
            <th scope="col">Status</th>
            <th scope="col">Data de cadastro</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {propriedades.contatos.map(function (contato) {
            return (
              <tr key={contato.id}>
                <td>{contato.nome}</td>
                <td className="texto-sem-quebra">{formatarTelefone(contato.telefone)}</td>
                <td>{contato.idade || '—'}</td>
                <td>{contato.bairro}</td>
                <td className="coluna-problema">{contato.problema}</td>
                <td>{exibirConsentimento(contato.autorizacaoMensagens)}</td>
                <td>{exibirConsentimento(contato.autorizacaoLigacoes)}</td>
                <td>{exibirTextoOuNaoInformado(contato.origemAtual)}</td>
                <td>{exibirTextoOuNaoInformado(contato.statusContato)}</td>
                <td className="texto-sem-quebra">{formatarData(contato.criadoEm)}</td>
                <td>
                  <Link className="link-detalhes" to={'/admin/contatos/' + contato.id}>
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TabelaContatos;
