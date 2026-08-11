const sessaoRepository = require(
  "../repositories/sessaoRepository"
);

const AppError = require(
  "../errors/AppError"
);

function normalizarId(
  valor
) {
  const id = Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function sanitizarUsuario(
  usuario
) {
  return {
    id:
      usuario.id,

    nome:
      usuario.nome,

    email:
      usuario.email,

    whatsapp:
      usuario.whatsapp,

    ativo:
      usuario.ativo,

    email_verificado_em:
      usuario.email_verificado_em,

    ultimo_login_em:
      usuario.ultimo_login_em,

    senha_alterada_em:
      usuario.senha_alterada_em,

    created_at:
      usuario.created_at,

    updated_at:
      usuario.updated_at,
  };
}

function montarNegocio(
  contexto
) {
  if (!contexto?.negocio_id) {
    return null;
  }

  return {
    id:
      contexto.negocio_id,

    nome:
      contexto.negocio_nome,

    slug:
      contexto.negocio_slug,

    descricao:
      contexto.negocio_descricao,

    setor:
      contexto.negocio_setor,

    whatsapp:
      contexto.negocio_whatsapp,

    foto_url:
      contexto.negocio_foto_url,

    cidade:
      contexto.negocio_cidade,

    estado:
      contexto.negocio_estado,

    bairro:
      contexto.negocio_bairro,

    endereco:
      contexto.negocio_endereco,

    numero:
      contexto.negocio_numero,

    complemento:
      contexto.negocio_complemento,

    cep:
      contexto.negocio_cep,

    localizacao_url:
      contexto.negocio_localizacao_url,

    latitude:
      contexto.negocio_latitude,

    longitude:
      contexto.negocio_longitude,

    fuso_horario:
      contexto.negocio_fuso_horario,

    publicado:
      contexto.negocio_publicado,

    papel:
      contexto.papel,

    vinculo_id:
      contexto.vinculo_id,

    vinculado_em:
      contexto.vinculado_em,

    created_at:
      contexto.negocio_created_at,

    updated_at:
      contexto.negocio_updated_at,
  };
}

function montarAdministrador(
  administrador
) {
  if (!administrador) {
    return null;
  }

  return {
    papel:
      administrador.papel,

    superadmin:
      administrador.papel ===
      "superadmin",
  };
}

/*
 * Retorna os dados atuais da sessão.
 *
 * O JWT fornece apenas o ID da conta.
 * O papel, o negócio e o contexto Admin
 * são consultados diretamente no banco.
 */
async function obterMinhaSessao(
  usuarioId
) {
  const id =
    normalizarId(
      usuarioId
    );

  if (!id) {
    throw new AppError(
      "Sessão inválida.",
      401
    );
  }

  const usuario =
    await sessaoRepository
      .buscarUsuarioPorId(id);

  if (!usuario) {
    throw new AppError(
      "Sessão inválida.",
      401
    );
  }

  if (
    usuario.ativo === false
  ) {
    throw new AppError(
      "Esta conta está desativada.",
      403
    );
  }

  const buscarAdministrador =
    sessaoRepository
      .buscarAdministradorAtivoPorUsuarioId;

  const [
    contexto,
    administrador,
  ] = await Promise.all([
    sessaoRepository
      .buscarContextoAtivoPorUsuarioId(
        id
      ),

    typeof buscarAdministrador ===
      "function"
      ? buscarAdministrador(id)
      : Promise.resolve(null),
  ]);

  const negocio =
    montarNegocio(
      contexto
    );

  const admin =
    montarAdministrador(
      administrador
    );

  return {
    usuario:
      sanitizarUsuario(
        usuario
      ),

    temNegocio:
      Boolean(negocio),

    negocio,

    administrador:
      admin,

    ehAdministrador:
      Boolean(admin),
  };
}

module.exports = {
  obterMinhaSessao,
};