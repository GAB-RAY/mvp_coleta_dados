import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CampoFormulario from '../components/CampoFormulario';
import MensagemRetorno from '../components/MensagemRetorno';
import { realizarLogin } from '../services/autenticacaoService';
import { obterToken, salvarToken } from '../utils/armazenamentoToken';

function Login() {
  const navegacao = useNavigate();
  const localizacao = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [mensagem, setMensagem] = useState(
    localizacao.state && localizacao.state.mensagem
      ? localizacao.state.mensagem
      : ''
  );

  useEffect(function () {
    if (obterToken()) {
      navegacao('/admin/contatos', { replace: true });
    }
  }, [navegacao]);

  function alterarEmail(evento) {
    setEmail(evento.target.value);
  }

  function alterarSenha(evento) {
    setSenha(evento.target.value);
  }

  async function enviarLogin(evento) {
    evento.preventDefault();
    setMensagem('');

    if (!email.trim() || !senha) {
      setMensagem('Informe o email e a senha.');
      return;
    }

    setEntrando(true);

    try {
      const resposta = await realizarLogin(email.trim(), senha);

      if (!resposta || !resposta.token) {
        throw new Error('Não foi possível iniciar a sessão.');
      }

      salvarToken(resposta.token);

      const destino = localizacao.state && localizacao.state.origem
        ? localizacao.state.origem
        : '/admin/contatos';

      navegacao(destino, { replace: true });
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main className="pagina-login">
      <section className="cartao cartao-login" aria-labelledby="titulo-login">
        <Link className="link-voltar" to="/">← Voltar ao formulário</Link>

        <div className="cabecalho-login">
          <span className="marca-sistema">A Voz do Bairro</span>
          <h1 id="titulo-login">Acesso administrativo</h1>
          <p>Entre com suas credenciais para consultar os contatos cadastrados.</p>
        </div>

        <MensagemRetorno mensagem={mensagem} tipo="erro" />

        <form className="formulario-login" onSubmit={enviarLogin} noValidate>
          <CampoFormulario
            id="email"
            rotulo="Email"
            tipo="email"
            valor={email}
            aoAlterar={alterarEmail}
            placeholder="admin@email.com"
            obrigatorio
            desabilitado={entrando}
            autoComplete="username"
          />

          <CampoFormulario
            id="senha"
            rotulo="Senha"
            tipo="password"
            valor={senha}
            aoAlterar={alterarSenha}
            placeholder="Digite sua senha"
            obrigatorio
            desabilitado={entrando}
            autoComplete="current-password"
          />

          <button className="botao botao-primario" type="submit" disabled={entrando}>
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
