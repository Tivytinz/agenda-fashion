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

const AppError = require(
  "../errors/AppError"
);

const {
  normalizarEspecialidades,
} = require(
  "../domain/especialidadesNegocio"
);

const {
  correspondeAoTipo,
} = require(
  "../utils/validarImagem"
);

const uploadToCloudinary = require(
  "../utils/uploadCloudinary"
);

const registrador = require(
  "../utils/registrador"
);

const ESTADOS_BRASILEIROS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

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

  if (!normalizarWhatsapp(
    negocio?.whatsapp ??
      negocio?.whatsapp_negocio,
    {
      validar:
        false,
    }
  )) {
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

  return montarRespostaNegocio({
    negocio,
    papel:
      vinculo.papel,
  });
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

  const recebeuEspecialidades =
    possuiCampo(
      entrada,
      "especialidades"
    ) ||
    possuiCampo(
      entrada,
      "areas"
    );

  const especialidades =
    normalizarEspecialidades(
      possuiCampo(
        entrada,
        "especialidades"
      )
        ? entrada.especialidades
        : possuiCampo(
            entrada,
            "areas"
          )
          ? entrada.areas
          : negocioAtual.areas,
      {
        setorLegado:
          negocioAtual.setor,

        legado:
          !recebeuEspecialidades,
      }
    );

  const nomeAtualizado =
    normalizarNome(
      possuiCampo(
        entrada,
        "nome"
      )
        ? entrada.nome
        : negocioAtual.nome
    );

  const nomeFoiAlterado =
    nomeAtualizado !==
    normalizarNome(
      negocioAtual.nome
    );

  const dadosAtualizados = {
    nome:
      nomeAtualizado,

    // O nome é a fonte oficial do endereço público. O slug atual só é
    // preservado quando o nome não mudou, inclusive em atualizações parciais.
    slug:
      nomeFoiAlterado
        ? normalizarSlug(
            nomeAtualizado
          )
        : negocioAtual.slug,

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
      especialidades[0] ||
      "",

    cidade:
      normalizarCidade(
        possuiCampo(
          entrada,
          "cidade"
        )
          ? entrada.cidade
          : negocioAtual.cidade
      ),

    estado:
      normalizarEstado(
        possuiCampo(
          entrada,
          "estado"
        )
          ? entrada.estado
          : negocioAtual.estado
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

    endereco:
      normalizarTexto(
        possuiCampo(
          entrada,
          "endereco"
        )
          ? entrada.endereco
          : negocioAtual.endereco,
        {
          nomeCampo:
            "Endereço",

          tamanhoMaximo:
            180,
        }
      ),

    numero:
      normalizarTexto(
        possuiCampo(
          entrada,
          "numero"
        )
          ? entrada.numero
          : negocioAtual.numero,
        {
          nomeCampo:
            "Número",

          tamanhoMaximo:
            20,
        }
      ),

    complemento:
      normalizarTexto(
        possuiCampo(
          entrada,
          "complemento"
        )
          ? entrada.complemento
          : negocioAtual.complemento,
        {
          nomeCampo:
            "Complemento",

          tamanhoMaximo:
            120,
        }
      ),

    cep:
      normalizarCep(
        possuiCampo(
          entrada,
          "cep"
        )
          ? entrada.cep
          : negocioAtual.cep
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
      especialidades,
  };

  let negocioAtualizado;

  try {
    negocioAtualizado =
      await configuracoesRepository
        .atualizarNegocio(
          vinculo.negocio_id,
          dadosAtualizados
        );
  } catch (erro) {
    if (
      erro?.code ===
      "SLUG_INDISPONIVEL"
    ) {
      throw new AppError(
        "Já existe um negócio com um endereço igual ao gerado por esse nome. Diferencie o nome e tente novamente.",
        409
      );
    }

    throw erro;
  }

  exigirRecurso(
    negocioAtualizado,
    "Negócio não encontrado."
  );

  return montarRespostaNegocio({
    negocio:
      negocioAtualizado,

    papel:
      vinculo.papel,

    mensagem:
      "Configurações salvas com sucesso.",
  });
}

async function removerImagemSilenciosamente(
  publicId
) {
  if (
    !publicId ||
    typeof uploadToCloudinary.remover !==
      "function"
  ) {
    return;
  }

  try {
    await uploadToCloudinary.remover(
      publicId
    );
  } catch (erro) {
    registrador.aviso(
      "[Cloudinary] Não foi possível remover uma foto de negócio órfã.",
      {
        public_id:
          publicId,

        erro:
          erro?.message,
      }
    );
  }
}

async function enviarFotoNegocio({
  usuarioId,
  arquivo,
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
      "Apenas o dono pode alterar a foto do negócio."
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

  const imagem =
    validarArquivoImagem(
      arquivo
    );

  let upload;

  try {
    upload =
      await uploadToCloudinary(
        imagem.buffer,
        "saas-agendamento/negocios"
      );
  } catch {
    throw new AppError(
      "Não foi possível enviar a foto agora.",
      502
    );
  }

  const fotoUrl = String(
    upload?.secure_url ||
    upload?.url ||
    ""
  ).trim();

  const fotoPublicId = String(
    upload?.public_id ||
    ""
  ).trim();

  if (!fotoUrl || !fotoPublicId) {
    await removerImagemSilenciosamente(
      fotoPublicId
    );

    throw new AppError(
      "O provedor de imagens retornou uma resposta inválida.",
      502
    );
  }

  let negocioAtualizado;

  try {
    negocioAtualizado =
      await configuracoesRepository
        .atualizarFotoNegocio({
          negocioId:
            vinculo.negocio_id,

          fotoUrl,

          fotoPublicId,
        });
  } catch (erro) {
    await removerImagemSilenciosamente(
      fotoPublicId
    );

    throw erro;
  }

  if (!negocioAtualizado) {
    await removerImagemSilenciosamente(
      fotoPublicId
    );

    exigirRecurso(
      negocioAtualizado,
      "Negócio não encontrado."
    );
  }

  if (
    negocioAtual.foto_public_id &&
    negocioAtual.foto_public_id !==
      fotoPublicId
  ) {
    await removerImagemSilenciosamente(
      negocioAtual.foto_public_id
    );
  }

  return montarRespostaNegocio({
    negocio: {
      ...negocioAtual,
      ...negocioAtualizado,
    },

    papel:
      vinculo.papel,

    mensagem:
      "Foto do negócio atualizada com sucesso.",
  });
}

async function alterarPublicacao({
  usuarioId,
  publicado,
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
      "Apenas o dono pode alterar a publicação do negócio."
    );
  }

  if (
    typeof publicado !==
    "boolean"
  ) {
    throw new ValidationError(
      "Informe se o negócio deve ficar publicado."
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

  const publicacao =
    avaliarPublicacao(
      negocioAtual
    );

  if (
    publicado &&
    !publicacao.pode_publicar
  ) {
    throw new ValidationError(
      `Complete o perfil antes de publicar: ${publicacao.pendencias.join(", ")}.`
    );
  }

  const resultado =
    await configuracoesRepository
      .atualizarPublicacao(
        vinculo.negocio_id,
        publicado
      );

  exigirRecurso(
    resultado,
    "Negócio não encontrado."
  );

  const negocioAtualizado = {
    ...negocioAtual,
    publicado:
      resultado.publicado,
  };

  return montarRespostaNegocio({
    negocio:
      negocioAtualizado,

    papel:
      vinculo.papel,

    mensagem:
      resultado.publicado
        ? "Seu negócio está publicado e já pode aparecer na página inicial."
        : "Seu negócio foi retirado da página inicial.",
  });
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes,
  enviarFotoNegocio,
  alterarPublicacao,
};
