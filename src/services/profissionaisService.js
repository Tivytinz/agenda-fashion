const profissionaisRepository = require("../repositories/profissionaisRepository");
const db = require("../db/db");
const {
  buscarUsoPlano,
  criarErroLimite
} = require("./planoService");

const {
  exigirUsuario,
  exigirCampo,
  exigirRecurso,
  exigirPermissao
} = require("../validators/commonValidator");

const ForbiddenError = require("../errors/ForbiddenError");
const ValidationError = require("../errors/ValidationError");

function normalizarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarWhatsapp(valor) {
  let numeros = String(valor ?? "").replace(/\D/g, "");

  if (
    (numeros.length === 12 || numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    numeros = numeros.slice(2);
  }

  return numeros;
}

function validarWhatsappOpcional(valor) {
  const whatsapp = normalizarWhatsapp(valor);

  if (!whatsapp) {
    return null;
  }

  if (!/^[0-9]{10,11}$/.test(whatsapp)) {
    throw new ValidationError("WhatsApp do profissional inválido.");
  }

  return whatsapp;
}

function normalizarIdentificadorProfissional(valor) {
  const identificador = normalizarTexto(valor).toLowerCase();

  if (identificador.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identificador)) {
      throw new ValidationError(
        "Informe um e-mail ou WhatsApp válido."
      );
    }

    return {
      email: identificador,
      whatsapp: ""
    };
  }

  const whatsapp = normalizarWhatsapp(identificador);

  if (!/^[0-9]{10,11}$/.test(whatsapp)) {
    throw new ValidationError(
      "Informe um e-mail ou WhatsApp válido."
    );
  }

  return {
    email: "",
    whatsapp
  };
}

async function listarProfissionais({ usuarioId }) {
  exigirUsuario(usuarioId);

  const dono =
    await profissionaisRepository.buscarNegocioDono(
      usuarioId
    );

  exigirPermissao(
    dono,
    "Apenas o dono pode listar profissionais."
  );

  const profissionais =
    await profissionaisRepository
      .listarProfissionaisDoNegocio(
        dono.negocio_id
      );

  return { profissionais };
}

async function editarProfissional({
  usuarioId,
  profissionalId,
  nome,
  whatsapp
}) {
  exigirUsuario(usuarioId);
  exigirCampo(profissionalId, "Profissional não informado.");
  exigirCampo(nome, "Nome do profissional é obrigatório.");

  const nomeLimpo = normalizarTexto(nome);
  const whatsappLimpo = validarWhatsappOpcional(whatsapp);

  if (nomeLimpo.length < 2 || nomeLimpo.length > 120) {
    throw new ValidationError("Nome do profissional inválido.");
  }

  const vinculo =
    await profissionaisRepository.buscarNegocioDono(usuarioId);

  exigirPermissao(
    vinculo,
    "Apenas o dono pode editar profissionais."
  );

  const pertence =
    await profissionaisRepository.verificarProfissionalNoNegocio(
      profissionalId,
      vinculo.negocio_id
    );

  exigirRecurso(
    pertence,
    "Profissional não encontrado neste negócio."
  );

  const profissional =
    await profissionaisRepository.atualizarProfissional(
      profissionalId,
      nomeLimpo,
      whatsappLimpo
    );

  exigirRecurso(
    profissional,
    "Profissional não encontrado neste negócio."
  );

  return {
    mensagem: "Profissional atualizado com sucesso.",
    profissional
  };
}

async function removerProfissional({
  usuarioId,
  profissionalId
}) {
  exigirUsuario(usuarioId);
  exigirCampo(profissionalId, "Profissional não informado.");

  const vinculo =
    await profissionaisRepository.buscarNegocioDono(usuarioId);

  exigirPermissao(
    vinculo,
    "Apenas o dono pode remover profissionais."
  );

  if (Number(usuarioId) === Number(profissionalId)) {
    throw new ForbiddenError(
      "O dono não pode remover a si mesmo."
    );
  }

  const removido =
    await profissionaisRepository.removerVinculo(
      profissionalId,
      vinculo.negocio_id
    );

  exigirRecurso(removido, "Profissional não encontrado.");

  return {
    mensagem: "Profissional removido do negócio."
  };
}

async function vincularProfissional({
  usuarioDonoId,
  emailOuWhatsapp
}) {
  exigirUsuario(usuarioDonoId);
  exigirCampo(
    emailOuWhatsapp,
    "Informe o e-mail ou WhatsApp do profissional."
  );

  const dono =
    await profissionaisRepository.buscarNegocioDono(
      usuarioDonoId
    );

  exigirPermissao(
    dono,
    "Apenas o dono pode adicionar profissionais."
  );

  const {
    email,
    whatsapp
  } = normalizarIdentificadorProfissional(emailOuWhatsapp);

  const profissional =
    await profissionaisRepository.buscarProfissionalPorEmailWhatsapp(
      email,
      whatsapp
    );

  exigirRecurso(
    profissional,
    "Profissional não encontrado. Ele precisa criar uma conta primeiro."
  );

  await db.executarTransacao(async (client) => {
    await profissionaisRepository.bloquearCadastroProfissional(
      client,
      dono.negocio_id
    );

    await buscarUsoPlano(
      dono.negocio_id,
      client
    );

    const jaVinculado =
      await profissionaisRepository.verificarVinculo(
        profissional.id,
        dono.negocio_id,
        client
      );

    if (jaVinculado) {
      throw new ValidationError(
        "Este profissional já está vinculado ao negócio."
      );
    }

    const plano = await profissionaisRepository.buscarPlanoDoNegocio(
      dono.negocio_id,
      client
    );

    if (!plano) {
      const erro = new Error("Plano do negócio não encontrado.");
      erro.status = 404;
      erro.statusCode = 404;
      throw erro;
    }

    const utilizados =
      await profissionaisRepository.contarProfissionaisAtivos(
        dono.negocio_id,
        client
      );

    const limite = plano.limite_profissionais;

    if (limite !== null && utilizados >= Number(limite)) {
      throw criarErroLimite(
        `Você atingiu o limite de ${limite} profissional(is) do plano ${plano.nome}. Faça upgrade para adicionar mais.`,
        "LIMITE_PROFISSIONAIS",
        {
          plano_nome: plano.nome,
          utilizados,
          limite: Number(limite),
        }
      );
    }

    await profissionaisRepository.criarVinculo(
      profissional.id,
      dono.negocio_id,
      client
    );
  });

  return {
    mensagem: "Profissional vinculado com sucesso.",
    profissional
  };
}

module.exports = {
  listarProfissionais,
  vincularProfissional,
  editarProfissional,
  removerProfissional
};
