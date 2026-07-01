const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRepository = require("../repositories/authRepository");

const JWT_SECRET = "segredo";
const TOKEN_EXPIRES_IN = "90d";

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      tipo: usuario.tipo
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRES_IN
    }
  );
}

async function cadastro({
  nome,
  email,
  senha,
  whatsapp,
  tipo
}) {
  if (!nome || !email || !senha || !whatsapp) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  if (senha.trim().length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }

  const emailLimpo = email.trim().toLowerCase();
  const tipoUsuario = tipo || "cliente";

  const usuarioExistente =
    await authRepository.buscarUsuarioPorEmail(emailLimpo);

  if (usuarioExistente) {
    throw new Error("Email já cadastrado.");
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuarioCriado = await authRepository.criarUsuario({
    nome: nome.trim(),
    email: emailLimpo,
    senha: senhaHash,
    whatsapp: whatsapp.trim(),
    tipo: tipoUsuario
  });

  const token = gerarToken(usuarioCriado);

  return {
    mensagem: "Usuário cadastrado com sucesso.",
    token,
    usuario: usuarioCriado
  };
}

async function login({ email, senha }) {
  if (!email || !senha) {
    throw new Error("Email e senha são obrigatórios.");
  }

  const emailLimpo = email.trim().toLowerCase();

  const usuario = await authRepository.buscarUsuarioPorEmail(emailLimpo);

  if (!usuario) {
    throw new Error("Usuário não encontrado.");
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha);

  if (!senhaValida) {
    throw new Error("Senha inválida.");
  }

  const token = gerarToken(usuario);

  return {
    mensagem: "Login realizado com sucesso.",
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      whatsapp: usuario.whatsapp,
      tipo: usuario.tipo
    }
  };
}

async function meuNegocio({ usuarioId }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  const negocio = await authRepository.buscarMeuNegocio(usuarioId);

  if (!negocio) {
    return {
      temNegocio: false
    };
  }

  return {
    temNegocio: true,
    negocio
  };
}

module.exports = {
  cadastro,
  login,
  meuNegocio
};