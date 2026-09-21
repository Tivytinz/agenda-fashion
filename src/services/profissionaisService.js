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

const CONVITE_EXPIRACAO_DIAS = 7;

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

function criarErroStatus(mensagem, status, codigo) {
  const erro = new Error(mensagem);
  erro.status = status;
  erro.statusCode = status;

  if (codigo) {
    erro.codigo = codigo;
  }

  return erro;
}

function calcularExpiracaoConvite() {
  return new Date(
    Date.now() +
      CONVITE_EXPIRACAO_DIAS * 24 * 60 * 60 * 1000
  );
}

function normalizarUsoPlano(usoPlano) {
  if (!usoPlano) {
    throw criarErroStatus(
      "Plano do negócio não encontrado.",
      404
    );
  }

  return {
    utilizados: Number(
      usoPlano.profissionais_utilizados || 0
    ),
    limite: usoPlano.limite_profissionais,
    planoNome: usoPlano.plano_nome || "plano atual",
  };
}

function possuiCapacidadePlano(usoPlano) {
  const { utilizados, limite } = normalizarUsoPlano(usoPlano);

  return limite === null || utilizados < Number(limite);
}

function validarLimitePlano(usoPlano) {
  const {
    utilizados,
    limite,
    planoNome,
  } = normalizarUsoPlano(usoPlano);

  if (limite !== null && utilizados >= Number(limite)) {
    const limiteNumerico = Number(limite);
    const acimaDoLimite = Math.max(
      0,
      utilizados - limiteNumerico
    );
    const mensagem = acimaDoLimite > 0
      ? `Você possui ${utilizados} profissional(is) ativo(s), ${acimaDoLimite} acima do limite de ${limiteNumerico} do plano ${planoNome}. Faça upgrade para adicionar novos profissionais.`
      : `Você atingiu o limite de ${limiteNumerico} profissional(is) do plano ${planoNome}. Faça upgrade para adicionar mais.`;

    throw criarErroLimite(
      mensagem,
      "LIMITE_PROFISSIONAIS",
      {
        plano_nome: planoNome,
        utilizados,
        limite: limiteNumerico,
        acima_do_limite: acimaDoLimite,
      }
    );
  }
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
      vinculo.negocio_id,
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

function criarErroAgendamentosFuturos(quantidade) {
  const total = Number(quantidade || 0);
  const erro = new Error(
    total === 1
      ? "Esta profissional possui 1 agendamento futuro ativo neste negócio. Resolva esse compromisso antes de removê-la da equipe."
      : `Esta profissional possui ${total} agendamentos futuros ativos neste negócio. Resolva esses compromissos antes de removê-la da equipe.`
  );
  erro.status = 409;
  erro.statusCode = 409;

  return erro;
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

  const resultado =
    await profissionaisRepository.removerVinculo(
      profissionalId,
      vinculo.negocio_id
    );

  if (Number(resultado?.agendamentosFuturos || 0) > 0) {
    throw criarErroAgendamentosFuturos(
      resultado.agendamentosFuturos
    );
  }

  exigirRecurso(
    resultado?.removido,
    "Profissional não encontrado."
  );

  return {
    mensagem: "Profissional removido do negócio."
  };
}

async function criarConviteProfissional({
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
    "Apenas o dono pode convidar profissionais."
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

  if (Number(profissional.id) === Number(usuarioDonoId)) {
    throw new ValidationError(
      "O dono já faz parte deste negócio."
    );
  }

  const convite = await db.executarTransacao(
    async (client) => {
      await profissionaisRepository.bloquearCadastroProfissional(
        client,
        dono.negocio_id
      );

      const vinculo =
        await profissionaisRepository.verificarVinculo(
          profissional.id,
          dono.negocio_id,
          client
        );

      if (vinculo?.ativo) {
        throw new ValidationError(
          "Este profissional já está vinculado ao negócio."
        );
      }

      await profissionaisRepository.expirarConvitesPendentes(
        dono.negocio_id,
        profissional.id,
        client
      );

      const existente =
        await profissionaisRepository.buscarConvitePendente(
          dono.negocio_id,
          profissional.id,
          client
        );

      if (existente) {
        throw new ValidationError(
          "Já existe um convite pendente para este profissional."
        );
      }

      const criado = await profissionaisRepository.criarConvite(
        {
          negocioId: dono.negocio_id,
          usuarioConvidadoId: profissional.id,
          convidadoPorUsuarioId: usuarioDonoId,
          expiraEm: calcularExpiracaoConvite(),
        },
        client
      );

      if (!criado) {
        throw new ValidationError(
          "Já existe um convite pendente para este profissional."
        );
      }

      return criado;
    }
  );

  return {
    mensagem:
      "Convite enviado. O vínculo será criado somente após o aceite do profissional.",
    convite: {
      id: convite.id,
      status: convite.status,
      expira_em: convite.expira_em,
      profissional: {
        id: profissional.id,
        nome: profissional.nome,
        foto_url: profissional.foto_url || null,
      },
    },
  };
}

async function vincularProfissional(args) {
  return criarConviteProfissional(args);
}

async function listarConvitesRecebidos({ usuarioId }) {
  exigirUsuario(usuarioId);

  const convites =
    await profissionaisRepository.listarConvitesRecebidos(
      usuarioId
    );

  return { convites };
}

async function aceitarConviteProfissional({
  usuarioId,
  conviteId
}) {
  exigirUsuario(usuarioId);
  exigirCampo(conviteId, "Convite não informado.");

  const resultado = await db.executarTransacao(
    async (client) => {
      const convite =
        await profissionaisRepository.buscarConviteParaAtualizacao(
          conviteId,
          client
        );

      if (!convite) {
        return { erro: "NAO_ENCONTRADO" };
      }

      if (
        Number(convite.usuario_convidado_id) !==
        Number(usuarioId)
      ) {
        return { erro: "SEM_PERMISSAO" };
      }

      if (convite.status === "aceito") {
        const vinculo =
          await profissionaisRepository.verificarVinculo(
            usuarioId,
            convite.negocio_id,
            client
          );

        if (vinculo?.ativo) {
          return {
            convite,
            jaAceito: true,
            aguardandoVaga: false,
          };
        }

        if (
          vinculo?.papel === "profissional" &&
          vinculo?.motivo_inatividade === "aguardando_vaga_plano"
        ) {
          return {
            convite,
            jaAceito: true,
            aguardandoVaga: true,
          };
        }

        return { erro: "CONVITE_FINALIZADO" };
      }

      if (convite.status !== "pendente") {
        return { erro: "CONVITE_FINALIZADO" };
      }

      if (new Date(convite.expira_em).getTime() <= Date.now()) {
        await profissionaisRepository.atualizarStatusConvite(
          convite.id,
          "expirado",
          client
        );

        return { erro: "CONVITE_EXPIRADO" };
      }

      if (!convite.negocio_ativo || !convite.usuario_ativo) {
        return { erro: "CONTEXTO_INATIVO" };
      }

      await profissionaisRepository.bloquearCadastroProfissional(
        client,
        convite.negocio_id
      );

      const vinculoMesmoNegocio =
        await profissionaisRepository.verificarVinculo(
          usuarioId,
          convite.negocio_id,
          client
        );

      if (vinculoMesmoNegocio?.ativo) {
        const conviteAceito =
          await profissionaisRepository.atualizarStatusConvite(
            convite.id,
            "aceito",
            client
          );

        return {
          convite: conviteAceito,
          jaAceito: true,
          aguardandoVaga: false,
        };
      }

      const vinculoOutroNegocio =
        await profissionaisRepository.buscarVinculoProfissionalAtivo(
          usuarioId,
          client
        );

      if (vinculoOutroNegocio) {
        return {
          erro: "JA_VINCULADO_OUTRO_NEGOCIO",
          negocio: vinculoOutroNegocio,
        };
      }

      const usoPlano = await buscarUsoPlano(
        convite.negocio_id,
        client
      );

      if (!possuiCapacidadePlano(usoPlano)) {
        const aguardando =
          await profissionaisRepository.criarOuMarcarVinculoAguardandoVaga(
            usuarioId,
            convite.negocio_id,
            client
          );

        if (!aguardando) {
          throw criarErroStatus(
            "Não foi possível registrar o vínculo aguardando vaga.",
            409
          );
        }

        const conviteAceito =
          await profissionaisRepository.atualizarStatusConvite(
            convite.id,
            "aceito",
            client
          );

        return {
          convite: conviteAceito,
          jaAceito: false,
          aguardandoVaga: true,
        };
      }

      try {
        if (vinculoMesmoNegocio && !vinculoMesmoNegocio.ativo) {
          const reativado =
            await profissionaisRepository.reativarVinculoProfissional(
              usuarioId,
              convite.negocio_id,
              client
            );

          if (!reativado) {
            throw criarErroStatus(
              "Não foi possível reativar o vínculo profissional.",
              409
            );
          }
        } else {
          await profissionaisRepository.criarVinculo(
            usuarioId,
            convite.negocio_id,
            client
          );
        }
      } catch (erro) {
        if (
          erro?.code === "23505" &&
          erro?.constraint ===
            "usuarios_negocios_profissional_ativo_unique"
        ) {
          return { erro: "JA_VINCULADO_OUTRO_NEGOCIO" };
        }

        throw erro;
      }

      const conviteAceito =
        await profissionaisRepository.atualizarStatusConvite(
          convite.id,
          "aceito",
          client
        );

      return {
        convite: conviteAceito,
        jaAceito: false,
        aguardandoVaga: false,
      };
    }
  );

  if (resultado.erro === "NAO_ENCONTRADO") {
    throw criarErroStatus(
      "Convite não encontrado.",
      404
    );
  }

  if (resultado.erro === "SEM_PERMISSAO") {
    throw new ForbiddenError(
      "Este convite pertence a outro usuário."
    );
  }

  if (resultado.erro === "CONVITE_EXPIRADO") {
    throw criarErroStatus(
      "Este convite expirou.",
      410,
      "CONVITE_EXPIRADO"
    );
  }

  if (resultado.erro === "CONVITE_FINALIZADO") {
    throw criarErroStatus(
      "Este convite já foi finalizado.",
      409,
      "CONVITE_FINALIZADO"
    );
  }

  if (resultado.erro === "CONTEXTO_INATIVO") {
    throw criarErroStatus(
      "Não é possível aceitar este convite porque a conta ou o negócio está inativo.",
      409
    );
  }

  if (resultado.erro === "JA_VINCULADO_OUTRO_NEGOCIO") {
    throw criarErroStatus(
      "Você já possui vínculo profissional ativo com outro negócio.",
      409,
      "PROFISSIONAL_JA_VINCULADO"
    );
  }

  return {
    mensagem: resultado.aguardandoVaga
      ? (
        resultado.jaAceito
          ? "Convite já aceito. Você está aguardando uma vaga no plano deste negócio."
          : "Convite aceito. Este negócio ainda não possui uma vaga disponível no plano atual. Você entrará na equipe quando a dona liberar uma vaga."
      )
      : (
        resultado.jaAceito
          ? "Convite já estava aceito."
          : "Convite aceito. Você agora faz parte da equipe."
      ),
    convite: {
      id: resultado.convite.id,
      negocio_id: resultado.convite.negocio_id,
      status: "aceito",
    },
    vinculo: {
      ativo: !resultado.aguardandoVaga,
      estado: resultado.aguardandoVaga
        ? "aguardando_vaga"
        : "ativo",
    },
  };
}

async function ativarProfissional({
  usuarioId,
  profissionalId
}) {
  exigirUsuario(usuarioId);
  exigirCampo(profissionalId, "Profissional não informado.");

  const dono =
    await profissionaisRepository.buscarNegocioDono(
      usuarioId
    );

  exigirPermissao(
    dono,
    "Apenas o dono pode ativar profissionais."
  );

  const resultado = await db.executarTransacao(
    async (client) => {
      await profissionaisRepository.bloquearCadastroProfissional(
        client,
        dono.negocio_id
      );

      const vinculo =
        await profissionaisRepository.verificarVinculo(
          profissionalId,
          dono.negocio_id,
          client
        );

      if (
        !vinculo ||
        vinculo.papel !== "profissional"
      ) {
        return { erro: "NAO_ENCONTRADO" };
      }

      if (vinculo.ativo) {
        return { jaAtivo: true };
      }

      if (
        vinculo.motivo_inatividade !==
        "aguardando_vaga_plano"
      ) {
        return { erro: "NAO_AGUARDA_VAGA" };
      }

      const vinculoOutroNegocio =
        await profissionaisRepository.buscarVinculoProfissionalAtivo(
          profissionalId,
          client
        );

      if (vinculoOutroNegocio) {
        return { erro: "JA_VINCULADO_OUTRO_NEGOCIO" };
      }

      const usoPlano = await buscarUsoPlano(
        dono.negocio_id,
        client
      );

      validarLimitePlano(usoPlano);

      const ativado =
        await profissionaisRepository.ativarVinculoProfissionalAguardandoVaga(
          profissionalId,
          dono.negocio_id,
          client
        );

      if (!ativado) {
        return { erro: "NAO_ATIVADO" };
      }

      return { jaAtivo: false };
    }
  );

  if (resultado.erro === "NAO_ENCONTRADO") {
    throw criarErroStatus(
      "Profissional não encontrado neste negócio.",
      404
    );
  }

  if (resultado.erro === "NAO_AGUARDA_VAGA") {
    throw criarErroStatus(
      "Este vínculo não está aguardando vaga no plano.",
      409,
      "VINCULO_NAO_AGUARDA_VAGA"
    );
  }

  if (resultado.erro === "JA_VINCULADO_OUTRO_NEGOCIO") {
    throw criarErroStatus(
      "Esta profissional já possui vínculo profissional ativo com outro negócio.",
      409,
      "PROFISSIONAL_JA_VINCULADO"
    );
  }

  if (resultado.erro === "NAO_ATIVADO") {
    throw criarErroStatus(
      "Não foi possível ativar a profissional.",
      409
    );
  }

  return {
    mensagem: resultado.jaAtivo
      ? "Profissional já estava ativa."
      : "Profissional ativada na equipe.",
    profissional_id: Number(profissionalId),
    ativo: true,
  };
}

async function recusarConviteProfissional({
  usuarioId,
  conviteId
}) {
  exigirUsuario(usuarioId);
  exigirCampo(conviteId, "Convite não informado.");

  const resultado = await db.executarTransacao(
    async (client) => {
      const convite =
        await profissionaisRepository.buscarConviteParaAtualizacao(
          conviteId,
          client
        );

      if (!convite) {
        return { erro: "NAO_ENCONTRADO" };
      }

      if (
        Number(convite.usuario_convidado_id) !==
        Number(usuarioId)
      ) {
        return { erro: "SEM_PERMISSAO" };
      }

      if (convite.status !== "pendente") {
        return { erro: "CONVITE_FINALIZADO" };
      }

      if (new Date(convite.expira_em).getTime() <= Date.now()) {
        await profissionaisRepository.atualizarStatusConvite(
          convite.id,
          "expirado",
          client
        );
        return { erro: "CONVITE_EXPIRADO" };
      }

      const recusado =
        await profissionaisRepository.atualizarStatusConvite(
          convite.id,
          "recusado",
          client
        );

      return { convite: recusado };
    }
  );

  if (resultado.erro === "NAO_ENCONTRADO") {
    throw criarErroStatus(
      "Convite não encontrado.",
      404
    );
  }

  if (resultado.erro === "SEM_PERMISSAO") {
    throw new ForbiddenError(
      "Este convite pertence a outro usuário."
    );
  }

  if (resultado.erro === "CONVITE_EXPIRADO") {
    throw criarErroStatus(
      "Este convite expirou.",
      410,
      "CONVITE_EXPIRADO"
    );
  }

  if (resultado.erro === "CONVITE_FINALIZADO") {
    throw criarErroStatus(
      "Este convite já foi finalizado.",
      409,
      "CONVITE_FINALIZADO"
    );
  }

  return {
    mensagem: "Convite recusado.",
    convite: {
      id: resultado.convite.id,
      negocio_id: resultado.convite.negocio_id,
      status: "recusado",
    },
  };
}

module.exports = {
  listarProfissionais,
  vincularProfissional,
  criarConviteProfissional,
  listarConvitesRecebidos,
  aceitarConviteProfissional,
  ativarProfissional,
  recusarConviteProfissional,
  editarProfissional,
  removerProfissional
};
