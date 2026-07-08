const bcrypt = require("bcrypt");
const contaRepository = require("../repositories/contaRepository");
const uploadToCloudinary = require("../utils/uploadCloudinary");

function criarErro(mensagem, statusCode) {
  const err = new Error(mensagem);
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

function exigirUsuario(usuarioId) {
  if (!usuarioId) {
    throw criarErro("Usuário não autenticado.", 401);
  }
}

async function buscarMinhaConta({ usuarioId }) {
  exigirUsuario(usuarioId);

  const usuario = await contaRepository.buscarUsuarioPorId(usuarioId);

  if (!usuario) {
    throw criarErro("Usuário não encontrado.", 404);
  }

  return { usuario };
}

async function atualizarMinhaConta({ usuarioId, nome, whatsapp }) {
  exigirUsuario(usuarioId);

  if (!nome || nome.trim().length < 3) {
    throw criarErro("Nome inválido.", 400);
  }

  if (!whatsapp || whatsapp.trim().length < 8) {
    throw criarErro("WhatsApp inválido.", 400);
  }

  const usuario = await contaRepository.atualizarUsuario({
    usuarioId,
    nome: nome.trim(),
    whatsapp: whatsapp.trim(),
  });

  if (!usuario) {
    throw criarErro("Usuário não encontrado.", 404);
  }

  return {
    mensagem: "Conta atualizada com sucesso.",
    usuario,
  };
}

async function alterarSenha({ usuarioId, senhaAtual, novaSenha }) {
  exigirUsuario(usuarioId);

  if (!senhaAtual || !novaSenha) {
    throw criarErro("Informe a senha atual e a nova senha.", 400);
  }

  if (novaSenha.trim().length < 6) {
    throw criarErro("A nova senha deve ter pelo menos 6 caracteres.", 400);
  }

  const usuario = await contaRepository.buscarSenhaUsuario(usuarioId);

  if (!usuario) {
    throw criarErro("Usuário não encontrado.", 404);
  }

  const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);

  if (!senhaValida) {
    throw criarErro("Senha atual incorreta.", 401);
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);

  await contaRepository.atualizarSenha({
    usuarioId,
    senhaHash,
  });

  return {
    mensagem: "Senha alterada com sucesso.",
  };
}

async function enviarFotoUsuario({ usuarioId, file }) {
  exigirUsuario(usuarioId);

  if (!file) {
    throw criarErro("Nenhuma imagem enviada.", 400);
  }

  const resultado = await uploadToCloudinary(
    file.buffer,
    "saas-agendamento/usuarios"
  );

  await contaRepository.atualizarFotoUsuario({
    usuarioId,
    fotoUrl: resultado.secure_url,
    fotoPublicId: resultado.public_id,
  });

  return {
    mensagem: "Foto atualizada.",
    foto: resultado.secure_url,
  };
}

module.exports = {
  buscarMinhaConta,
  atualizarMinhaConta,
  alterarSenha,
  enviarFotoUsuario,
};