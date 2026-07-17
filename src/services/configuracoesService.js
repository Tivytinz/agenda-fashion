const configuracoesRepository = require(
  "../repositories/configuracoesRepository"
);

const {
  exigirUsuario,
  exigirRecurso,
} = require(
  "../validators/commonValidator"
);

const ForbiddenError = require(
  "../errors/ForbiddenError"
);

const ValidationError = require(
  "../errors/ValidationError"
);

const LIMITE_AREAS = 30;

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

function normalizarSetor(
  valor
) {
  return normalizarTexto(
    valor,
    {
      nomeCampo:
        "Setor",

      tamanhoMaximo:
        80,
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

function converterAreasParaArray(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return [];
  }

  if (
    Array.isArray(valor)
  ) {
    return valor;
  }

  if (
    typeof valor === "string"
  ) {
    const texto =
      valor.trim();

    if (!texto) {
      return [];
    }

    try {
      const convertido =
        JSON.parse(texto);

      if (
        Array.isArray(
          convertido
        )
      ) {
        return convertido;
      }
    } catch {
      /*
       * Caso não seja JSON, aceita:
       * "Unha, Cabelo, Estética".
       */
    }

    return texto.split(",");
  }

  throw new ValidationError(
    "As áreas atendidas são inválidas."
  );
}

function normalizarAreas(
  valor
) {
  const areasRecebidas =
    converterAreasParaArray(
      valor
    );

  const areas = [];
  const areasRegistradas =
    new Set();

  for (
    const areaRecebida
    of areasRecebidas
  ) {
    if (
      typeof areaRecebida !==
      "string"
    ) {
      throw new ValidationError(
        "Cada área atendida deve ser um texto."
      );
    }

    const area =
      areaRecebida
        .trim()
        .replace(/\s+/g, " ");

    if (!area) {
      continue;
    }

    if (
      area.length < 2
    ) {
      throw new ValidationError(
        "Cada área atendida deve ter pelo menos 2 caracteres."
      );
    }

    if (
      area.length > 60
    ) {
      throw new ValidationError(
        "Cada área atendida deve ter no máximo 60 caracteres."
      );
    }

    const chave =
      area.toLocaleLowerCase(
        "pt-BR"
      );

    if (
      areasRegistradas.has(
        chave
      )
    ) {
      continue;
    }

    areasRegistradas.add(
      chave
    );

    areas.push(area);
  }

  if (
    areas.length >
    LIMITE_AREAS
  ) {
    throw new ValidationError(
      `Informe no máximo ${LIMITE_AREAS} áreas atendidas.`
    );
  }

  return areas;
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

  return {
    ...negocio,

    whatsapp,

    /*
     * Mantido temporariamente porque o
     * frontend ainda usa esse nome.
     */
    whatsapp_negocio:
      whatsapp,

    areas:
      normalizarAreas(
        negocio.areas
      ),

    papel:
      papel ||
      negocio.papel ||
      null,
  };
}

async function obterVinculo(
  usuarioId
) {
  exigirUsuario(
    usuarioId
  );

  const vinculo =
    await configuracoesRepository
      .buscarNegocioDoUsuario(
        usuarioId
      );

  exigirRecurso(
    vinculo,
    "Usuário não está vinculado a nenhum negócio."
  );

  return vinculo;
}

async function buscarConfiguracoes({
  usuarioId,
}) {
  const vinculo =
    await obterVinculo(
      usuarioId
    );

  const negocio =
    await configuracoesRepository
      .buscarNegocioPorId(
        vinculo.negocio_id
      );

  exigirRecurso(
    negocio,
    "Negócio não encontrado."
  );

  const negocioNormalizado =
    normalizarNegocio(
      negocio,
      vinculo.papel
    );

  return {
    negocio:
      negocioNormalizado,

    configuracoes:
      negocioNormalizado,
  };
}

async function salvarConfiguracoes({
  usuarioId,
  dados,
}) {
  const vinculo =
    await obterVinculo(
      usuarioId
    );

  if (
    vinculo.papel !==
    "dono"
  ) {
    throw new ForbiddenError(
      "Apenas o dono pode editar o negócio."
    );
  }

  const negocioAtual =
    await configuracoesRepository
      .buscarNegocioPorId(
        vinculo.negocio_id
      );

  exigirRecurso(
    negocioAtual,
    "Negócio não encontrado."
  );

  const entrada =
    dados &&
    typeof dados === "object" &&
    !Array.isArray(dados)
      ? dados
      : {};

  const whatsappRecebido =
    possuiCampo(
      entrada,
      "whatsapp_negocio"
    )
      ? entrada.whatsapp_negocio
      : possuiCampo(
          entrada,
          "whatsapp"
        )
        ? entrada.whatsapp
        : negocioAtual.whatsapp ??
          negocioAtual.whatsapp_negocio;

  const dadosAtualizados = {
    nome:
      normalizarNome(
        possuiCampo(
          entrada,
          "nome"
        )
          ? entrada.nome
          : negocioAtual.nome
      ),

    /*
     * Foto é alterada somente pela rota
     * própria de upload.
     */
    foto_url:
      negocioAtual.foto_url ||
      null,

    descricao:
      normalizarDescricao(
        possuiCampo(
          entrada,
          "descricao"
        )
          ? entrada.descricao
          : negocioAtual.descricao
      ),

    setor:
      normalizarSetor(
        possuiCampo(
          entrada,
          "setor"
        )
          ? entrada.setor
          : negocioAtual.setor
      ),

    cidade:
      normalizarCidade(
        possuiCampo(
          entrada,
          "cidade"
        )
          ? entrada.cidade
          : negocioAtual.cidade
      ),

    bairro:
      normalizarBairro(
        possuiCampo(
          entrada,
          "bairro"
        )
          ? entrada.bairro
          : negocioAtual.bairro
      ),

    localizacao_url:
      normalizarUrl(
        possuiCampo(
          entrada,
          "localizacao_url"
        )
          ? entrada.localizacao_url
          : negocioAtual.localizacao_url
      ),

    whatsapp_negocio:
      normalizarWhatsapp(
        whatsappRecebido
      ),

    areas:
      normalizarAreas(
        possuiCampo(
          entrada,
          "areas"
        )
          ? entrada.areas
          : negocioAtual.areas
      ),
  };

  const negocioAtualizado =
    await configuracoesRepository
      .atualizarNegocio(
        vinculo.negocio_id,
        dadosAtualizados
      );

  exigirRecurso(
    negocioAtualizado,
    "Negócio não encontrado."
  );

  const negocioNormalizado =
    normalizarNegocio(
      negocioAtualizado,
      vinculo.papel
    );

  return {
    mensagem:
      "Configurações salvas com sucesso.",

    negocio:
      negocioNormalizado,

    configuracoes:
      negocioNormalizado,
  };
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes,
};