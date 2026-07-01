const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const authRepository = require("../repositories/authRepository");

const JWT_SECRET = process.env.JWT_SECRET || "segredo";
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || "90d";

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      tipo: usuario.tipo
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function cadastro({ nome, email, senha, whatsapp, tipo }) {
  if (!nome || !email || !senha || !whatsapp) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  if (!validarEmail(email)) {
    throw new Error("E-mail inválido.");
  }

  if (senha.trim().length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }

  const emailLimpo = email.trim().toLowerCase();
  const tipoUsuario = tipo || "cliente";

  const existe = await authRepository.emailExiste(emailLimpo);

  if (existe) {
    throw new Error("Email já cadastrado.");
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await authRepository.criarUsuario({
    nome: nome.trim(),
    email: emailLimpo,
    senhaHash,
    whatsapp: whatsapp.trim(),
    tipo: tipoUsuario
  });

  const token = gerarToken(usuario);

  return {
    mensagem: "Usuário cadastrado com sucesso.",
    token,
    usuario
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
    const erro = new Error("Senha inválida.");
    erro.status = 401;
    throw erro;
  }

  const token = gerarToken(usuario);
  const negocio = await authRepository.buscarNegocioDoUsuario(usuario.id);

  return {
    mensagem: "Login realizado com sucesso.",
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      whatsapp: usuario.whatsapp,
      tipo: usuario.tipo
    },
    negocio,
    temNegocio: !!negocio
  };
}

async function meuNegocio(usuarioId) {
  if (!usuarioId) {
    const erro = new Error("Usuário não autenticado.");
    erro.status = 401;
    throw erro;
  }

  const negocio = await authRepository.buscarNegocioDoUsuario(usuarioId);

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