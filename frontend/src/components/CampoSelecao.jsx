function CampoSelecao(propriedades) {
  return (
    <div className="grupo-campo">
      <label htmlFor={propriedades.id}>
        {propriedades.rotulo}
        {propriedades.obrigatorio && (
          <span className="indicador-obrigatorio" aria-hidden="true"> *</span>
        )}
      </label>

      <div className="envoltorio-selecao">
        <select
          id={propriedades.id}
          name={propriedades.nome || propriedades.id}
          className="campo-input campo-selecao"
          value={propriedades.valor}
          onChange={propriedades.aoAlterar}
          required={propriedades.obrigatorio}
          disabled={propriedades.desabilitado}
        >
          <option value="">{propriedades.placeholder}</option>
          {propriedades.opcoes.map(function (opcaoRecebida) {
            const opcao = typeof opcaoRecebida === 'string'
              ? { valor: opcaoRecebida, rotulo: opcaoRecebida }
              : opcaoRecebida;

            return (
              <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

export default CampoSelecao;
