function MarcaAcordaRJ(propriedades) {
  const classeAdicional = propriedades.className ? ' ' + propriedades.className : '';
  const somenteSimbolo = Boolean(propriedades.somenteSimbolo);

  return (
    <span
      className={'marca-acorda-rj' + classeAdicional}
      aria-label={somenteSimbolo ? 'ACORDA RJ' : undefined}
    >
      <img
        className="marca-acorda-rj-simbolo"
        src="/identidade/acorda-rj-simbolo-192.png"
        alt=""
        aria-hidden="true"
      />
      {!somenteSimbolo && <strong className="marca-acorda-rj-nome">ACORDA RJ</strong>}
    </span>
  );
}

export default MarcaAcordaRJ;
