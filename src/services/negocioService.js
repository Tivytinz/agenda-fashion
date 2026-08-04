const negocioRepository = require(
  "../repositories/negocioRepository"
);

const AppError = require(
  "../errors/AppError"
);

const {
  normalizarEspecialidades,
} = require(
  "../domain/especialidadesNegocio"
);

function normalizarId(valor) {
  const id = Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizarCampoOpcional({
  valor,
  limite,
  campo,
}) {
  const texto =
    normalizarTexto(valor);

  if (!texto) {
    return null;
  }

  if (texto.length > limite) {
    throw new AppError(
      `${campo} excede o limite de ${limite} caracteres.`,
      400
    );
  }

  return texto;
}

function normalizarWhatsapp(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  let numeros =
    String(valor)
      .replace(/\D/g, "");

  if (
    (numeros.length === 12 ||
      numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    numeros =
      numeros.slice(2);
  }

  if (
    ![10, 11].includes(
      numeros.length
    )
  ) {
    throw new AppError(
      "Digite um WhatsApp válido.",
      400
    );
  }

  return numeros;
}

function normalizarEstado(valor) {
  const estado =
    normalizarTexto(valor)
      .toUpperCase();

  if (!estado) {
    return null;
  }

  if (
    !/^[A-Z]{2}$/.test(
      estado
    )
  ) {
    throw new AppError(
      "Digite uma sigla de estado válida.",
      400
    );
  }

  return estado;
}

function normalizarCep(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const cep =
    String(valor)
      .replace(/\D/g, "");

  if (
    !/^[0-9]{8}$/.test(
      cep
    )
  ) {
    throw new AppError(
      "Digite um CEP válido.",
      400
    );
  }

  return cep;
}

function normalizarUrl(valor) {
  const texto =
    normalizarTexto(valor);

  if (!texto) {
    return null;
  }

  try {
    const url =
      new URL(texto);

    if (
      !["http:", "https:"].includes(
        url.protocol
      )
    ) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new AppError(
      "Digite uma URL de localização válida.",
      400
    );
  }
}

function normalizarCoordenada({
  valor,
  campo,
  minimo,
  maximo,
}) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const numero =
    Number(
      String(valor)
        .replace(",", ".")
    );

  if (
    !Number.isFinite(numero) ||
    numero < minimo ||
    numero > maximo
  ) {
    throw new AppError(
      `${campo} inválida.`,
      400
    );
  }

  return numero;
}

function normalizarFusoHorario(valor) {
  const fuso =
    normalizarTexto(valor) ||
    "America/Sao_Paulo";

  if (
    fuso.length < 3 ||
    fuso.length > 64
  ) {
    throw new AppError(
      "Fuso horário inválido.",
      400
    );
  }

  return fuso;
}

function gerarSlugBase(nome) {
  const slug =
    String(nome)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(0, 140)
      .replace(
        /-+$/g,
        ""
      );

  return slug || "negocio";
}

async function gerarSlugDisponivel(
  nome
) {
  const base =
    gerarSlugBase(nome);

  for (
    let contador = 0;
    contador < 100;
    contador += 1
  ) {
    const sufixo =
      contador === 0
        ? ""
        : `-${contador + 1}`;

    const limiteBase =
      160 - sufixo.length;

    const candidato =
      `${base.slice(
        0,
        limiteBase
      )}${sufixo}`;

    const existente =
      await negocioRepository
        .buscarNegocioPorSlug(
          candidato
        );

    if (!existente) {
      return candidato;
    }
  }

  return (
    `${base.slice(0, 145)}-` +
    `${Date.now()}`
  ).slice(0, 160);
}

function validarDadosNegocio(
  dados = {}
) {
  const nome =
    normalizarTexto(
      dados.nome
    );

  if (
    nome.length < 2 ||
    nome.length > 120
  ) {
    throw new AppError(
      "Digite um nome de negócio válido.",
      400
    );
  }

  const recebeuEspecialidades =
    Object.prototype.hasOwnProperty.call(
      dados,
      "especialidades"
    ) ||
    Object.prototype.hasOwnProperty.call(
      dados,
      "areas"
    );

  const especialidades =
    normalizarEspecialidades(
      dados.especialidades ??
        dados.areas,
      {
        setorLegado:
          dados.setor,

        legado:
          !recebeuEspecialidades,
      }
    );

  const latitude =
    normalizarCoordenada({
      valor:
        dados.latitude,

      campo:
        "Latitude",

      minimo:
        -90,

      maximo:
        90,
    });

  const longitude =
    normalizarCoordenada({
      valor:
        dados.longitude,

      campo:
        "Longitude",

      minimo:
        -180,

      maximo:
        180,
    });

  if (
    (
      latitude === null &&
      longitude !== null
    ) ||
    (
      latitude !== null &&
      longitude === null
    )
  ) {
    throw new AppError(
      "Latitude e longitude devem ser informadas juntas.",
      400
    );
  }

  return {
    nome,

    descricao:
      normalizarCampoOpcional({
        valor:
          dados.descricao,

        limite:
          1200,

        campo:
          "Descrição",
      }),

    setor:
      especialidades[0] ||
      null,

    areas:
      especialidades,

    whatsapp:
      normalizarWhatsapp(
        dados.whatsapp
      ),

    cidade:
      normalizarCampoOpcional({
        valor:
          dados.cidade,

        limite:
          100,

        campo:
          "Cidade",
      }),

    estado:
      normalizarEstado(
        dados.estado
      ),

    bairro:
      normalizarCampoOpcional({
        valor:
          dados.bairro,

        limite:
          100,

        campo:
          "Bairro",
      }),

    endereco:
      normalizarCampoOpcional({
        valor:
          dados.endereco,

        limite:
          180,

        campo:
          "Endereço",
      }),

    numero:
      normalizarCampoOpcional({
        valor:
          dados.numero,

        limite:
          20,

        campo:
          "Número",
      }),

    complemento:
      normalizarCampoOpcional({
        valor:
          dados.complemento,

        limite:
          120,

        campo:
          "Complemento",
      }),

    cep:
      normalizarCep(
        dados.cep
      ),

    localizacao_url:
      normalizarUrl(
        dados.localizacao_url
      ),

    latitude,

    longitude,

    fuso_horario:
      normalizarFusoHorario(
        dados.fuso_horario
      ),

    /*
     * Foto será enviada posteriormente
     * pelo endpoint específico de upload.
     */
    foto_url:
      null,

    foto_public_id:
      null,
  };
}

function converterErroRepository(
  erro
) {
  if (
    erro?.code ===
    "USUARIO_NAO_ENCONTRADO"
  ) {
    throw new AppError(
      "Sessão inválida.",
      401
    );
  }

  if (
    erro?.code ===
    "USUARIO_INATIVO"
  ) {
    throw new AppError(
      "Esta conta está desativada.",
      403
    );
  }

  if (
    erro?.code ===
    "DONO_JA_POSSUI_NEGOCIO"
  ) {
    throw new AppError(
      "Esta conta já possui um negócio.",
      409
    );
  }

  if (
    erro?.code === "23505" &&
    (
      erro?.constraint ===
        "usuarios_negocios_vinculo_unico" ||
      erro?.constraint ===
        "usuarios_negocios_dono_ativo_unique"
    )
  ) {
    throw new AppError(
      "Esta conta já possui um vínculo de negócio.",
      409
    );
  }

  throw erro;
}

/*
 * POST /criar-negocio
 *
 * Cria o negócio e vincula a conta
 * autenticada como dona.
 */
async function criar({
  usuarioId,
  ...dadosRecebidos
}) {
  const id =
    normalizarId(
      usuarioId
    );

  if (!id) {
    throw new AppError(
      "Você precisa entrar na sua conta.",
      401
    );
  }

  const negocioExistente =
    await negocioRepository
      .buscarNegocioDoDono(id);

  if (negocioExistente) {
    throw new AppError(
      "Esta conta já possui um negócio.",
      409
    );
  }

  const negocio =
    validarDadosNegocio(
      dadosRecebidos
    );

  /*
   * Repetimos somente em caso de colisão
   * de slug causada por duas requisições
   * simultâneas.
   */
  for (
    let tentativa = 0;
    tentativa < 5;
    tentativa += 1
  ) {
    negocio.slug =
      await gerarSlugDisponivel(
        negocio.nome
      );

    try {
      const resultado =
        await negocioRepository
          .criarNegocioComDono({
            usuarioId:
              id,

            negocio,
          });

      return {
        mensagem:
          "Negócio criado com sucesso.",

        temNegocio:
          true,

        negocio:
          resultado.negocio,
      };
    } catch (erro) {
      const colisaoSlug =
        erro?.code === "23505" &&
        erro?.constraint ===
          "negocios_slug_unique";

      if (
        colisaoSlug &&
        tentativa < 4
      ) {
        continue;
      }

      converterErroRepository(
        erro
      );
    }
  }

  throw new AppError(
    "Não foi possível gerar uma URL disponível para o negócio.",
    409
  );
}

/*
 * Compatibilidade temporária com
 * GET /meu-negocio.
 *
 * A rota principal de contexto continua
 * sendo GET /minha-sessao.
 */
async function buscarMeuNegocio(
  usuarioId
) {
  const id =
    normalizarId(
      usuarioId
    );

  if (!id) {
    throw new AppError(
      "Você precisa entrar na sua conta.",
      401
    );
  }

  const negocio =
    await negocioRepository
      .buscarNegocioDoDono(id);

  if (!negocio) {
    return {
      temNegocio:
        false,

      negocio:
        null,
    };
  }

  return {
    temNegocio:
      true,

    negocio,
  };
}

/*
 * Essa busca antiga não será utilizada
 * no novo fluxo de autenticação.
 */
async function buscarPorTermo() {
  throw new AppError(
    "A busca de negócios está temporariamente indisponível.",
    503
  );
}

/*
 * Entrada direta foi desativada.
 *
 * Vincular alguém como profissional
 * exigirá convite do dono.
 */
async function entrarNoNegocio() {
  throw new AppError(
    "Não é permitido entrar diretamente em um negócio. É necessário receber um convite.",
    403
  );
}

module.exports = {
  criar,
  buscarMeuNegocio,
  buscarPorTermo,
  entrarNoNegocio,
};
