const CATEGORIAS_CATALOGO = {
  unha: [
    "unha",
    "manicure",
    "pedicure",
    "esmalta",
    "nail",
    "alongamento"
  ],
  cabelo: [
    "cabelo",
    "cabeleire",
    "corte",
    "escova",
    "penteado",
    "progressiva",
    "barba",
    "barbear"
  ],
  cilio: ["cilio", "lash"],
  sobrancelha: [
    "sobrancelha",
    "brow",
    "micropigmenta"
  ],
  maquiagem: ["maquiagem", "makeup", "make up"],
  estetica: [
    "estetica",
    "limpeza de pele",
    "depilacao",
    "massagem",
    "drenagem",
    "facial",
    "corporal"
  ]
};

function termosDaCategoria(categoria) {
  const chave = String(categoria || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (!chave) return [];

  return CATEGORIAS_CATALOGO[chave] || [chave];
}

module.exports = {
  CATEGORIAS_CATALOGO,
  termosDaCategoria
};
