const ESPECIALIDADES_NEGOCIO = Object.freeze([
  "Unhas",
  "Cabelos",
  "Cílios",
  "Sobrancelhas",
  "Maquiagem",
  "Estética",
  "Bronzeamento",
  "Outro",
]);

const ESPECIALIDADE_POR_CATEGORIA = Object.freeze({
  unha: "Unhas",
  cabelo: "Cabelos",
  cilio: "Cílios",
  sobrancelha: "Sobrancelhas",
  maquiagem: "Maquiagem",
  estetica: "Estética",
  bronzeamento: "Bronzeamento",
  outro: "Outro",
});

function normalizarChave(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function identificarEspecialidade(valor, { legado = false } = {}) {
  const chave = normalizarChave(valor);

  if (!chave) return "";
  if (/unha|manicure|pedicure|nail|esmalta/.test(chave)) return "Unhas";
  if (/cabelo|cabeleir|barba|barbear/.test(chave)) return "Cabelos";
  if (/cilio|lash/.test(chave)) return "Cílios";
  if (/sobrancelha|brow|henna|micropigmenta/.test(chave)) return "Sobrancelhas";
  if (/maquiagem|makeup|make up/.test(chave)) return "Maquiagem";
  if (/bronzeamento|bronze artificial|bronze natural|marquinha|spray tan/.test(chave)) return "Bronzeamento";
  if (/estetica|pele|depil|massagem|drenagem|facial|corporal/.test(chave)) return "Estética";
  if (chave === "outro" || chave === "beleza" || chave.includes("salao de beleza")) return "Outro";

  if (legado) return "Outro";

  const erro = new Error("Selecione apenas especialidades válidas.");
  erro.status = 400;
  erro.statusCode = 400;
  throw erro;
}

function converterParaArray(valor) {
  if (Array.isArray(valor)) return valor;
  if (valor === undefined || valor === null || valor === "") return [];

  if (typeof valor === "string") {
    const texto = valor.trim();
    if (!texto) return [];

    try {
      const convertido = JSON.parse(texto);
      if (Array.isArray(convertido)) return convertido;
    } catch {
      // Compatibilidade com o antigo campo separado por vírgulas.
    }

    return texto.split(",");
  }

  const erro = new Error("As especialidades são inválidas.");
  erro.status = 400;
  erro.statusCode = 400;
  throw erro;
}

function normalizarEspecialidades(
  valor,
  { setorLegado = "", legado = false } = {}
) {
  const recebidas = converterParaArray(valor);

  if (recebidas.length === 0 && setorLegado) {
    recebidas.push(setorLegado);
  }

  const especialidades = [];
  const registradas = new Set();

  for (const recebida of recebidas) {
    if (typeof recebida !== "string") {
      const erro = new Error("Cada especialidade deve ser um texto.");
      erro.status = 400;
      erro.statusCode = 400;
      throw erro;
    }

    const especialidade = identificarEspecialidade(recebida, { legado });
    if (!especialidade || registradas.has(especialidade)) continue;

    registradas.add(especialidade);
    especialidades.push(especialidade);
  }

  return ESPECIALIDADES_NEGOCIO.filter((item) => registradas.has(item));
}

function especialidadeDaCategoria(categoria) {
  return ESPECIALIDADE_POR_CATEGORIA[normalizarChave(categoria)] || "Outro";
}

module.exports = {
  ESPECIALIDADES_NEGOCIO,
  especialidadeDaCategoria,
  normalizarEspecialidades,
};
