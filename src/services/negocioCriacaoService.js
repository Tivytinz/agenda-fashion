const negocioService = require(
  "./negocioService"
);

const AppError = require(
  "../errors/AppError"
);

const CAMPOS_OBRIGATORIOS = [
  ["nome", "Nome do negócio"],
  ["descricao", "Descrição"],
  ["whatsapp", "WhatsApp"],
  ["cidade", "Cidade"],
  ["estado", "Estado"],
  ["bairro", "Bairro"],
  ["endereco", "Endereço"],
  ["numero", "Número"],
  ["complemento", "Complemento"],
  ["cep", "CEP"],
  ["localizacao_url", "Link do Google Maps"],
];

function textoPreenchido(
  valor
) {
  return typeof valor === "string"
    ? Boolean(valor.trim())
    : valor !== undefined &&
        valor !== null;
}

function validarDadosObrigatorios(
  dados = {}
) {
  const especialidades =
    dados.especialidades ??
    dados.areas;

  if (
    !Array.isArray(especialidades) ||
    especialidades.length === 0
  ) {
    throw new AppError(
      "Preencha todas as informações do negócio antes de continuar. Campo pendente: Especialidades.",
      400
    );
  }

  for (
    const [campo, rotulo]
    of CAMPOS_OBRIGATORIOS
  ) {
    if (
      !textoPreenchido(
        dados[campo]
      )
    ) {
      throw new AppError(
        `Preencha todas as informações do negócio antes de continuar. Campo pendente: ${rotulo}.`,
        400
      );
    }
  }

  return dados;
}

async function criar(
  dados = {}
) {
  validarDadosObrigatorios(
    dados
  );

  return negocioService.criar(
    dados
  );
}

module.exports = {
  criar,
  validarDadosObrigatorios,
};
