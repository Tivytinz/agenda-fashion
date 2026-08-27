const adminCampaignRepository = require(
  "../repositories/adminCampaignRepository"
);
const marketingCostSyncRepository = require(
  "../repositories/marketingCostSyncRepository"
);
const providers = require(
  "./marketingCostProviders"
);
const {
  CAMPANHA_OFICIAL,
} = require(
  "./marketingCanonicalCleanupService"
);

const PROVEDOR = "google_ads";
const UTM_SOURCE = "google";
const UTM_MEDIUM = "cpc";

function normalizarIdExterno(valor) {
  return String(valor || "")
    .replace(/^act_/i, "")
    .replace(/\D/g, "");
}

function chaveExterna(item) {
  const conta = normalizarIdExterno(
    item?.contaExternaId ??
      item?.conta_externa_id
  );
  const campanha = normalizarIdExterno(
    item?.campanhaExternaId ??
      item?.campanha_externa_id
  );

  return conta && campanha
    ? `${conta}:${campanha}`
    : null;
}

function normalizarNome(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function campanhaOriginalCompativel(item) {
  const nome = normalizarNome(
    item?.campanhaExternaNome
  );
  const tipo = String(item?.tipo || "")
    .trim()
    .toUpperCase();

  return (
    tipo === "SEARCH" &&
    nome.includes("aquisicao") &&
    nome.includes("profission")
  );
}

function statusGoogle() {
  return providers
    .status()
    .find(
      (item) => item.provedor === PROVEDOR
    ) || null;
}

async function buscarCampanhaInternaOficial() {
  const identidade =
    await adminCampaignRepository
      .buscarPorIdentidade({
        utmSource: UTM_SOURCE,
        utmMedium: UTM_MEDIUM,
        utmCampaign: CAMPANHA_OFICIAL,
      });

  if (!identidade?.id) {
    return null;
  }

  return adminCampaignRepository
    .buscarPorId(Number(identidade.id));
}

async function validarVinculoExistente(
  campanhaInterna,
  vinculos
) {
  const existente =
    (vinculos || []).find(
      (item) =>
        Number(item.campanha_id) ===
        Number(campanhaInterna.id)
    );

  if (!existente) {
    return null;
  }

  let campanhaOriginal;

  try {
    campanhaOriginal =
      await providers.buscarCampanha(
        PROVEDOR,
        existente.campanha_externa_id
      );
  } catch (erro) {
    const status = Number(
      erro?.statusCode || erro?.status || 0
    );

    if (status === 404) {
      return null;
    }

    throw erro;
  }

  const chavePersistida =
    chaveExterna(existente);
  const chaveOriginal =
    chaveExterna(campanhaOriginal);

  if (
    !chavePersistida ||
    chavePersistida !== chaveOriginal
  ) {
    return null;
  }

  const nomeOriginal = String(
    campanhaOriginal.campanhaExternaNome || ""
  ).trim() || null;

  if (
    nomeOriginal !==
    (existente.campanha_externa_nome || null)
  ) {
    await marketingCostSyncRepository
      .salvarVinculo({
        campanhaId: Number(campanhaInterna.id),
        provedor: PROVEDOR,
        contaExternaId:
          normalizarIdExterno(
            campanhaOriginal.contaExternaId
          ),
        campanhaExternaId:
          normalizarIdExterno(
            campanhaOriginal.campanhaExternaId
          ),
        campanhaExternaNome: nomeOriginal,
      });
  }

  return {
    reparado: false,
    jaVinculado: true,
    campanhaId: Number(campanhaInterna.id),
    campanhaExternaId:
      normalizarIdExterno(
        campanhaOriginal.campanhaExternaId
      ),
    campanhaExternaNome: nomeOriginal,
    motivo: "vinculo_original_verificado",
  };
}

async function repararVinculoGoogleProfissionais({
  periodo,
} = {}) {
  const integracao = statusGoogle();

  if (!integracao?.configurado) {
    return {
      reparado: false,
      jaVinculado: false,
      motivo: "google_ads_nao_configurado",
    };
  }

  const campanhaInterna =
    await buscarCampanhaInternaOficial();

  if (
    !campanhaInterna ||
    campanhaInterna.ativo === false ||
    campanhaInterna.canal !== "google" ||
    campanhaInterna.objetivo !== "profissional"
  ) {
    return {
      reparado: false,
      jaVinculado: false,
      motivo: "campanha_interna_incompativel",
    };
  }

  const vinculos =
    await marketingCostSyncRepository
      .buscarVinculosPorProvedor(PROVEDOR);

  const existente =
    await validarVinculoExistente(
      campanhaInterna,
      vinculos
    );

  if (existente) {
    return existente;
  }

  if (
    !periodo?.dataInicio ||
    !periodo?.dataFim
  ) {
    return {
      reparado: false,
      jaVinculado: false,
      motivo: "periodo_ausente",
    };
  }

  const [campanhasExternas, custos] =
    await Promise.all([
      providers.listarCampanhas(PROVEDOR),
      providers.listarCustos(
        PROVEDOR,
        periodo
      ),
    ]);

  const chavesComGasto = new Set(
    (custos || [])
      .map(chaveExterna)
      .filter(Boolean)
  );
  const chavesJaVinculadas = new Set(
    (vinculos || [])
      .filter(
        (item) =>
          Number(item.campanha_id) !==
          Number(campanhaInterna.id)
      )
      .map(chaveExterna)
      .filter(Boolean)
  );

  const candidatas =
    (campanhasExternas || [])
      .filter(campanhaOriginalCompativel)
      .filter((item) => {
        const chave = chaveExterna(item);
        return (
          chave &&
          chavesComGasto.has(chave) &&
          !chavesJaVinculadas.has(chave)
        );
      });

  if (candidatas.length !== 1) {
    return {
      reparado: false,
      jaVinculado: false,
      motivo:
        candidatas.length === 0
          ? "campanha_original_nao_determinada"
          : "campanha_original_ambigua",
      candidatas: candidatas.length,
    };
  }

  const candidata = candidatas[0];
  const campanhaOriginal =
    await providers.buscarCampanha(
      PROVEDOR,
      candidata.campanhaExternaId
    );

  if (
    !campanhaOriginalCompativel(
      campanhaOriginal
    ) ||
    chaveExterna(campanhaOriginal) !==
      chaveExterna(candidata)
  ) {
    return {
      reparado: false,
      jaVinculado: false,
      motivo: "campanha_original_mudou",
    };
  }

  const contaExternaId =
    normalizarIdExterno(
      campanhaOriginal.contaExternaId
    );
  const campanhaExternaId =
    normalizarIdExterno(
      campanhaOriginal.campanhaExternaId
    );
  const campanhaExternaNome = String(
    campanhaOriginal.campanhaExternaNome || ""
  ).trim() || null;

  await marketingCostSyncRepository
    .salvarVinculo({
      campanhaId: Number(campanhaInterna.id),
      provedor: PROVEDOR,
      contaExternaId,
      campanhaExternaId,
      campanhaExternaNome,
    });

  return {
    reparado: true,
    jaVinculado: false,
    campanhaId: Number(campanhaInterna.id),
    campanhaExternaId,
    campanhaExternaNome,
    motivo: "campanha_original_google_verificada",
  };
}

module.exports = {
  repararVinculoGoogleProfissionais,
  campanhaOriginalCompativel,
  normalizarNome,
  chaveExterna,
};
