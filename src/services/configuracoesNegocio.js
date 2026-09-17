const ValidationError = require("../errors/ValidationError");
const {
  normalizarEspecialidades,
} = require("../domain/especialidadesNegocio");
const { correspondeAoTipo } = require("../utils/validarImagem");
const ESTADOS_BRASILEIROS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const { urlPublicacaoValida } = require("../domain/urlPublicacao");

const TAMANHO_MAXIMO_FOTO =
  5 * 1024 * 1024;

const TIPOS_IMAGEM_PERMITIDOS =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function validarArquivoImagem(
  arquivo
) {
  if (
    !arquivo ||
    !Buffer.isBuffer(
      arquivo.buffer
    )
  ) {
    throw new ValidationError(
      "Selecione uma foto para o negócio."
    );
  }

  if (
    arquivo.size >
    TAMANHO_MAXIMO_FOTO
  ) {
    throw new ValidationError(
      "A imagem deve ter no máximo 5 MB."
    );
  }

  if (
    !TIPOS_IMAGEM_PERMITIDOS.has(
      arquivo.mimetype
    ) ||
    !correspondeAoTipo(
      arquivo.buffer,
      arquivo.mimetype
    )
  ) {
    throw new ValidationError(
      "Use uma imagem JPG, PNG ou WEBP válida."
    );
  }

  return arquivo;
}

function possuiCampo(
  objeto,
  campo
) {
  return Object.prototype
    .hasOwnProperty.call(
      objeto,
      campo
    );
}

function normalizarTexto(
  valor,
  {
    nomeCampo,
    tamanhoMaximo,
    obrigatorio = false,
    tamanhoMinimo = 0,
  }
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    valor = "";
  }

  if (
    typeof valor !== "string"
  ) {
    throw new ValidationError(
      `${nomeCampo} inválido.`
    );
  }

  const texto =
    valor
      .trim()
      .replace(/\s+/g, " ");

  if (
    obrigatorio &&
    texto.length === 0
  ) {
    throw new ValidationError(
      `${nomeCampo} é obrigatório.`
    );
  }

  if (
    texto.length > 0 &&
    texto.length <
      tamanhoMinimo
  ) {
    throw new ValidationError(
      `${nomeCampo} deve ter pelo menos ${tamanhoMinimo} caracteres.`
    );
  }

  if (
    texto.length >
    tamanhoMaximo
  ) {
    throw new ValidationError(
      `${nomeCampo} deve ter no máximo ${tamanhoMaximo} caracteres.`
    );
  }

  return texto;
}

function normalizarNome(
  valor
) {
  return normalizarTexto(
    valor,
    {
      nomeCampo:
        "Nome do negócio",

      tamanhoMaximo:
        120,

      tamanhoMinimo:
        2,

      obrigatorio:
        true,
    }
  );
}

function normalizarSlug(
  valor
) {
  if (
    typeof valor !== "string"
  ) {
    throw new ValidationError(
      "Endereço público inválido."
    );
  }

  const slug = valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );

  if (
    slug.length < 2 ||
    slug.length > 80
  ) {
    throw new ValidationError(
      "Não foi possível gerar um endereço público válido a partir do nome."
    );
  }

  return slug;
}

function normalizarDescricao(
  valor
) {
  return normalizarTexto(
    valor,
    {
      nomeCampo:
        "Descrição",

      tamanhoMaximo:
        1000,
    }
  );
}

function normalizarCidade(
  valor
) {
  return normalizarTexto(
    valor,
    {
      nomeCampo:
        "Cidade",

      tamanhoMaximo:
        120,
    }
  );
}

function normalizarBairro(
  valor
) {
  return normalizarTexto(
    valor,
    {
      nomeCampo:
        "Bairro",

      tamanhoMaximo:
        120,
    }
  );
}

function normalizarEstado(
  valor
) {
  const estado =
    normalizarTexto(
      valor,
      {
        nomeCampo:
          "Estado",

        tamanhoMaximo:
          2,
      }
    ).toUpperCase();

  if (
    estado &&
    !ESTADOS_BRASILEIROS.has(
      estado
    )
  ) {
    throw new ValidationError(
      "Selecione um estado válido."
    );
  }

  return estado;
}

function normalizarCep(
  valor
) {
  const cep = String(
    valor ?? ""
  ).replace(/\D/g, "");

  if (
    cep &&
    !/^\d{8}$/.test(cep)
  ) {
    throw new ValidationError(
      "Digite um CEP válido."
    );
  }

  return cep;
}

function normalizarWhatsapp(
  valor,
  {
    validar = true,
  } = {}
) {
  let numeros =
    String(
      valor ?? ""
    ).replace(
      /\D/g,
      ""
    );

  /*
   * Remove o código brasileiro quando
   * o frontend envia +55.
   */
  if (
    (
      numeros.length === 12 ||
      numeros.length === 13
    ) &&
    numeros.startsWith("55")
  ) {
    numeros =
      numeros.slice(2);
  }

  if (
    validar &&
    numeros.length > 0 &&
    ![10, 11].includes(
      numeros.length
    )
  ) {
    throw new ValidationError(
      "Digite um WhatsApp válido com DDD."
    );
  }

  return numeros;
}

function normalizarUrl(
  valor
) {
  const url =
    normalizarTexto(
      valor,
      {
        nomeCampo:
          "Link de localização",

        tamanhoMaximo:
          2048,
      }
    );

  if (!url) {
    return "";
  }

  let urlValidada;

  try {
    urlValidada =
      new URL(url);
  } catch {
    throw new ValidationError(
      "Digite um link de localização válido."
    );
  }

  if (
    ![
      "http:",
      "https:",
    ].includes(
      urlValidada.protocol
    )
  ) {
    throw new ValidationError(
      "O link de localização deve começar com http:// ou https://."
    );
  }

  return urlValidada.toString();
}

function normalizarNegocio(
  negocio,
  papel
) {
  if (!negocio) {
    return null;
  }

  const whatsapp =
    normalizarWhatsapp(
      negocio.whatsapp ??
      negocio.whatsapp_negocio,
      {
        validar:
          false,
      }
    );

  const especialidades =
    normalizarEspecialidades(
      negocio.areas,
      {
        setorLegado:
          negocio.setor,

        legado:
          true,
      }
    );

  return {
    ...negocio,

    whatsapp,

    /*
     * Mantido temporariamente porque o
     * frontend ainda usa esse nome.
     */
    whatsapp_negocio:
      whatsapp,

    setor:
      negocio.setor ||
      especialidades[0] ||
      null,

    areas:
      especialidades,

    especialidades,

    papel:
      papel ||
      negocio.papel ||
      null,
  };
}

function avaliarPublicacao(
  negocio
) {
  const pendencias = [];

  const camposObrigatorios = [
    ["nome", "nome do negócio"],
    ["bairro", "bairro"],
    ["endereco", "endereço"],
    ["numero", "número"],
  ];

  for (
    const [campo, rotulo]
    of camposObrigatorios
  ) {
    if (
      !String(
        negocio?.[campo] ?? ""
      ).trim()
    ) {
      pendencias.push(rotulo);
    }
  }

  if (
    !urlPublicacaoValida(
      negocio?.localizacao_url
    )
  ) {
    pendencias.push(
      "link do Google Maps"
    );
  }

  const especialidades =
    normalizarEspecialidades(
      negocio?.areas,
      {
        setorLegado:
          negocio?.setor,

        legado:
          true,
      }
    );

  if (especialidades.length === 0) {
    pendencias.push(
      "pelo menos uma especialidade"
    );
  }

  const whatsapp =
    normalizarWhatsapp(
      negocio?.whatsapp ??
        negocio?.whatsapp_negocio,
      {
        validar:
          false,
      }
    );

  if (
    ![10, 11].includes(
      whatsapp.length
    )
  ) {
    pendencias.push(
      "WhatsApp"
    );
  }

  if (!normalizarTexto(
    negocio?.cidade,
    {
      nomeCampo:
        "Cidade",

      tamanhoMaximo:
        120,
    }
  )) {
    pendencias.push(
      "cidade"
    );
  }

  if (
    !ESTADOS_BRASILEIROS.has(
      String(
        negocio?.estado || ""
      ).trim().toUpperCase()
    )
  ) {
    pendencias.push(
      "estado"
    );
  }

  const cep = String(
    negocio?.cep ?? ""
  ).replace(/\D/g, "");

  if (!/^\d{8}$/.test(cep)) {
    pendencias.push(
      "CEP"
    );
  }

  if (
    negocio?.possui_servico_ativo !==
    true
  ) {
    pendencias.push(
      "pelo menos um serviço ativo"
    );
  }

  return {
    publicado:
      negocio?.publicado ===
      true,

    pode_publicar:
      pendencias.length === 0,

    pendencias,
  };
}

function montarRespostaNegocio({
  negocio,
  papel,
  mensagem,
}) {
  const negocioNormalizado =
    normalizarNegocio(
      negocio,
      papel
    );

  return {
    ...(mensagem
      ? {
          mensagem,
        }
      : {}),

    negocio:
      negocioNormalizado,

    configuracoes:
      negocioNormalizado,

    publicacao:
      avaliarPublicacao(
        negocioNormalizado
      ),
  };
}

module.exports = {
  validarArquivoImagem,
  possuiCampo,
  normalizarTexto,
  normalizarNome,
  normalizarSlug,
  normalizarDescricao,
  normalizarCidade,
  normalizarBairro,
  normalizarEstado,
  normalizarCep,
  normalizarWhatsapp,
  normalizarUrl,
  normalizarNegocio,
  avaliarPublicacao,
  montarRespostaNegocio,
};
