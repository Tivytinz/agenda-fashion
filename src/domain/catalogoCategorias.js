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
    "micropigmenta",
    "design",
    "henna"
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

const CATEGORIAS_SERVICO = Object.freeze([
  "unha",
  "cabelo",
  "cilio",
  "sobrancelha",
  "maquiagem",
  "estetica",
  "outro"
]);

function normalizarCategoriaServico(categoria, { obrigatoria = true } = {}) {
  const chave = String(categoria || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (!chave && !obrigatoria) return null;
  if (!CATEGORIAS_SERVICO.includes(chave)) {
    const erro = new Error("Selecione uma categoria válida para o serviço.");
    erro.status = 400;
    erro.statusCode = 400;
    throw erro;
  }

  return chave;
}

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
  CATEGORIAS_SERVICO,
  normalizarCategoriaServico,
  termosDaCategoria
};
