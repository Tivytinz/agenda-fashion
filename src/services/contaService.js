const bcrypt = require("bcrypt");

const contaRepository = require(
  "../repositories/contaRepository"
);

const uploadToCloudinary = require(
  "../utils/uploadCloudinary"
);

const BCRYPT_ROUNDS = 10;

const TAMANHO_MAXIMO_FOTO =
  5 * 1024 * 1024;

const TIPOS_IMAGEM_PERMITIDOS =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function criarErro(
  mensagem,
  statusCode
) {
  const erro =
    new Error(mensagem);

  erro.status =
    statusCode;

  erro.statusCode =
    statusCode;

  return erro;
}

function normalizarUsuarioId(
  valor
) {
  const usuarioId =
    Number(valor);

  if (
    !Number.isInteger(
      usuarioId
    ) ||
    usuarioId <= 0
  ) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  return usuarioId;
}

function normalizarTexto(
  valor,
  limite
) {
  return String(
    valor ?? ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, limite);
}

function normalizarNome(
  valor
) {
  const nome =
    normalizarTexto(
      valor,
      120
    );

  if (
    nome.length < 2 ||
    nome.length > 120
  ) {
    throw criarErro(
      "Digite um nome válido.",
      400
    );
  }

  return nome;
}

function normalizarWhatsapp(
  valor
) {
  let whatsapp =
    String(valor ?? "")
      .replace(/\D/g, "");

  /*
   * Aceita números enviados com
   * o código brasileiro +55.
   */
  if (
    (
      whatsapp.length === 12 ||
      whatsapp.length === 13
    ) &&
    whatsapp.startsWith("55")
  ) {
    whatsapp =
      whatsapp.slice(2);
  }

  if (
    ![10, 11].includes(
      whatsapp.length
    )
  ) {
    throw criarErro(
      "Digite um WhatsApp válido com DDD.",
      400
    );
  }

  return whatsapp;
}

function validarSenha(
  valor,
  nomeCampo
) {
  if (
    typeof valor !== "string" ||
    !valor
  ) {
    throw criarErro(
      `Informe ${nomeCampo}.`,
      400
    );
  }

  if (
    valor.length < 6 ||
    valor.length > 72
  ) {
    throw criarErro(
      "A nova senha deve ter entre 6 e 72 caracteres.",
      400
    );
  }

  return valor;
}

function validarArquivoImagem(
  arquivo
) {
  if (!arquivo) {
    throw criarErro(
      "Nenhuma imagem enviada.",
      400
    );
  }

  if (
    !Buffer.isBuffer(
      arquivo.buffer
    ) ||
    arquivo.buffer.length === 0
  ) {
    throw criarErro(
      "O arquivo de imagem está vazio ou inválido.",
      400
    );
  }

  const tipo =
    String(
      arquivo.mimetype || ""
    ).toLowerCase();

  if (
    !TIPOS_IMAGEM_PERMITIDOS.has(
      tipo
    )
  ) {
    throw criarErro(
      "Envie uma imagem JPG, PNG ou WEBP.",
      400
    );
  }

  const tamanho =
    Number(
      arquivo.size ||
      arquivo.buffer.length
    );

  if (
    !Number.isFinite(tamanho) ||
    tamanho <= 0
  ) {
    throw criarErro(
      "O tamanho da imagem é inválido.",
      400
    );
  }

  if (
    tamanho >
    TAMANHO_MAXIMO_FOTO
  ) {
    throw criarErro(
      "A imagem deve ter no máximo 5 MB.",
      413
    );
  }

  return arquivo;
}

function validarContaAtiva(
  usuario
) {
  if (!usuario) {
    throw criarErro(
      "Usuário não encontrado.",
      404
    );
  }

  if (
    usuario.ativo === false
  ) {
    throw criarErro(
      "Esta conta está desativada.",
      403
    );
  }

  return usuario;
}

/*
 * GET /conta
 */
async function buscarMinhaConta({
  usuarioId,
}) {
  const id =
    normalizarUsuarioId(
      usuarioId
    );

  const usuario =
    await contaRepository
      .buscarUsuarioPorId(id);

  validarContaAtiva(
    usuario
  );

  return {
    usuario,
  };
}

/*
 * PUT /conta
 */
async function atualizarMinhaConta({
  usuarioId,
  nome,
  whatsapp,
}) {
  const id =
    normalizarUsuarioId(
      usuarioId
    );

  const nomeNormalizado =
    normalizarNome(nome);

  const whatsappNormalizado =
    normalizarWhatsapp(
      whatsapp
    );

  /*
   * Garante que a conta existe e
   * continua ativa antes da alteração.
   */
  const contaAtual =
    await contaRepository
      .buscarUsuarioPorId(id);

  validarContaAtiva(
    contaAtual
  );

  const usuario =
    await contaRepository
      .atualizarUsuario({
        usuarioId:
          id,

        nome:
          nomeNormalizado,

        whatsapp:
          whatsappNormalizado,
      });

  if (!usuario) {
    throw criarErro(
      "Usuário não encontrado.",
      404
    );
  }

  return {
    mensagem:
      "Conta atualizada com sucesso.",

    usuario,
  };
}

/*
 * PUT /conta/senha
 */
async function alterarSenha({
  usuarioId,
  senhaAtual,
  novaSenha,
}) {
  const id =
    normalizarUsuarioId(
      usuarioId
    );

  if (
    typeof senhaAtual !==
      "string" ||
    !senhaAtual
  ) {
    throw criarErro(
      "Informe a senha atual.",
      400
    );
  }

  const novaSenhaValidada =
    validarSenha(
      novaSenha,
      "a nova senha"
    );

  const usuario =
    await contaRepository
      .buscarSenhaUsuario(id);

  validarContaAtiva(
    usuario
  );

  if (!usuario.senha) {
    throw criarErro(
      "A senha da conta não está disponível.",
      500
    );
  }

  const senhaAtualValida =
    await bcrypt.compare(
      senhaAtual,
      usuario.senha
    );

  if (!senhaAtualValida) {
  throw criarErro(
    "Senha atual incorreta.",
    400
  );
}

  const senhaRepetida =
    await bcrypt.compare(
      novaSenhaValidada,
      usuario.senha
    );

  if (senhaRepetida) {
    throw criarErro(
      "A nova senha deve ser diferente da senha atual.",
      400
    );
  }

  const senhaHash =
    await bcrypt.hash(
      novaSenhaValidada,
      BCRYPT_ROUNDS
    );

  const atualizacao =
    await contaRepository
      .atualizarSenha({
        usuarioId:
          id,

        senhaHash,
      });

  if (!atualizacao) {
    throw criarErro(
      "Usuário não encontrado.",
      404
    );
  }

  return {
    mensagem:
      "Senha alterada com sucesso.",

    senha_alterada_em:
      atualizacao
        .senha_alterada_em,
  };
}

/*
 * POST /conta/foto
 */
async function enviarFotoUsuario({
  usuarioId,
  arquivo,
}) {
  const id =
    normalizarUsuarioId(
      usuarioId
    );

  const imagem =
    validarArquivoImagem(
      arquivo
    );

  const usuarioAtual =
    await contaRepository
      .buscarUsuarioPorId(id);

  validarContaAtiva(
    usuarioAtual
  );

  let upload;

  try {
    upload =
      await uploadToCloudinary(
        imagem.buffer,
        "saas-agendamento/usuarios"
      );
  } catch {
    throw criarErro(
      "Não foi possível enviar a foto agora.",
      502
    );
  }

  const fotoUrl =
    String(
      upload?.secure_url ||
      upload?.url ||
      ""
    ).trim();

  const fotoPublicId =
    String(
      upload?.public_id || ""
    ).trim();

  if (
    !fotoUrl ||
    !fotoPublicId
  ) {
    throw criarErro(
      "O provedor de imagens retornou uma resposta inválida.",
      502
    );
  }

  const usuario =
    await contaRepository
      .atualizarFotoUsuario({
        usuarioId:
          id,

        fotoUrl,

        fotoPublicId,
      });

  if (!usuario) {
    throw criarErro(
      "Usuário não encontrado.",
      404
    );
  }

  return {
    mensagem:
      "Foto atualizada com sucesso.",

    foto:
      usuario.foto_url ||
      fotoUrl,

    usuario,
  };
}

module.exports = {
  buscarMinhaConta,
  atualizarMinhaConta,
  alterarSenha,
  enviarFotoUsuario,
};