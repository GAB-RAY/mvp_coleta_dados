import PaginaLegal, { obterEmailPrivacidade } from '../components/PaginaLegal';

function ExcluirDados() {
  const emailPrivacidade = obterEmailPrivacidade();
  const assunto = encodeURIComponent('Solicitação de exclusão de dados - Acorda VK');

  return (
    <PaginaLegal
      etiqueta="Direitos do titular"
      titulo="Solicitar exclusão de dados"
      introducao="Você pode pedir a exclusão do seu cadastro e interromper as comunicações do projeto Acorda VK."
    >
      <section>
        <h2>Como solicitar</h2>
        <p>
          Envie uma mensagem pelo canal de atendimento informado nesta página com o assunto
          <strong> “Solicitação de exclusão de dados”</strong>. Informe seu nome e o telefone
          utilizado no cadastro. Não envie documentos ou dados pessoais adicionais sem que a
          equipe solicite.
        </p>
        {emailPrivacidade && (
          <a className="botao-solicitacao-legal" href={'mailto:' + emailPrivacidade + '?subject=' + assunto}>
            Enviar solicitação por e-mail
          </a>
        )}
      </section>

      <section>
        <h2>Confirmação de identidade</h2>
        <p>
          Antes da exclusão, a equipe poderá solicitar uma confirmação mínima para impedir que
          outra pessoa apague o seu cadastro indevidamente.
        </p>
      </section>

      <section>
        <h2>O que acontece depois</h2>
        <p>
          Após o registro do pedido no sistema, mensagens e ligações ficam bloqueadas. A
          solicitação é analisada por um administrador e, quando aprovada, o cadastro é excluído,
          ressalvadas as informações cuja conservação seja exigida por lei.
        </p>
      </section>

      <section>
        <h2>Revogar sem excluir</h2>
        <p>
          Também é possível pedir somente a revogação de mensagens pelo WhatsApp ou de
          ligações pelo canal de atendimento, sem solicitar a exclusão completa do cadastro.
        </p>
      </section>
    </PaginaLegal>
  );
}

export default ExcluirDados;
