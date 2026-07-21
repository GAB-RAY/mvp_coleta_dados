function CampoFormulario(propriedades) {
  const id = propriedades.id;
  const nome = propriedades.nome || id;
  const tipo = propriedades.tipo || 'text';
  const classeCampo = propriedades.multilinha ? 'campo-textarea' : 'campo-input';

  return (
    <div className="grupo-campo">
      <label htmlFor={id}>
        {propriedades.rotulo}
        {propriedades.obrigatorio && (
          <span className="indicador-obrigatorio" aria-hidden="true"> *</span>
        )}
      </label>

      {propriedades.multilinha ? (
        <textarea
          id={id}
          name={nome}
          className={classeCampo}
          value={propriedades.valor}
          onChange={propriedades.aoAlterar}
          placeholder={propriedades.placeholder}
          required={propriedades.obrigatorio}
          disabled={propriedades.desabilitado}
          minLength={propriedades.tamanhoMinimo}
          maxLength={propriedades.tamanhoMaximo}
          rows={propriedades.linhas || 4}
        />
      ) : (
        <input
          id={id}
          name={nome}
          type={tipo}
          className={classeCampo}
          value={propriedades.valor}
          onChange={propriedades.aoAlterar}
          placeholder={propriedades.placeholder}
          required={propriedades.obrigatorio}
          disabled={propriedades.desabilitado}
          minLength={propriedades.tamanhoMinimo}
          maxLength={propriedades.tamanhoMaximo}
          autoComplete={propriedades.autoComplete}
          inputMode={propriedades.inputMode}
        />
      )}
    </div>
  );
}

export default CampoFormulario;
