const profissionaisRepository = require("../repositories/profissionaisRepository");

async function editarProfissional({
  usuarioId,
  profissionalId,
  nome,
  whatsapp
}) {
  const vinculo =
    await profissionaisRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    throw new Error("Apenas o dono pode editar profissionais.");
  }

  if (!nome || nome.trim().length < 2) {
    throw new Error("Nome do profissional inválido.");
  }

  const pertence =
    await profissionaisRepository.verificarProfissionalNoNegocio(
      profissionalId,
      vinculo.negocio_id
    );

  if (!pertence) {
    throw new Error("Profissional não encontrado neste negócio.");
  }

  const profissional =
    await profissionaisRepository.atualizarProfissional(
      profissionalId,
      nome.trim(),
      whatsapp || ""
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
  const vinculo =
    await profissionaisRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    throw new Error("Apenas o dono pode remover profissionais.");
  }

  if (Number(usuarioId) === Number(profissionalId)) {
    throw new Error("O dono não pode remover a si mesmo.");
  }

  const removido =
    await profissionaisRepository.removerVinculo(
      profissionalId,
      vinculo.negocio_id
    );

  if (!removido) {
    throw new Error("Profissional não encontrado.");
  }

  return {
    mensagem: "Profissional removido do negócio."
  };
}

async function vincularProfissional({
  usuarioDonoId,
  emailOuWhatsapp
}) {
  if (!emailOuWhatsapp) {
    throw new Error("Informe o e-mail ou WhatsApp do profissional.");
  }

  const dono =
    await profissionaisRepository.buscarNegocioDono(usuarioDonoId);

  if (!dono) {
    throw new Error("Apenas o dono pode adicionar profissionais.");
  }

  const valorLimpo = emailOuWhatsapp.trim().toLowerCase();
  const whatsappLimpo = emailOuWhatsapp.replace(/\D/g, "");

  const profissional =
    await profissionaisRepository.buscarProfissionalPorEmailWhatsapp(
      valorLimpo,
      whatsappLimpo
    );

  if (!profissional) {
    throw new Error("Profissional não encontrado. Ele precisa criar uma conta profissional primeiro.");
  }

  const jaVinculado =
    await profissionaisRepository.verificarVinculo(
      profissional.id,
      dono.negocio_id
    );

  if (jaVinculado) {
    throw new Error("Este profissional já está vinculado ao negócio.");
  }

  await profissionaisRepository.criarVinculo(
    profissional.id,
    dono.negocio_id
  );

  return {
    mensagem: "Profissional vinculado com sucesso.",
    profissional
  };
}

module.exports = {
  vincularProfissional,
  editarProfissional,
  removerProfissional
};