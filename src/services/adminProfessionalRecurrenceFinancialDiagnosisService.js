const PRIORIDADE_BLOQUEIOS = Object.freeze([
  "base_financeira_inconsistente",
  "origem_sem_evidencia",
  "atribuicao_paga_incompleta",
  "cobertura_custo_incompleta",
  "gasto_maduro_sem_profissional",
  "sem_base_custo",
  "sem_base_monetizacao",
  "maturidade_financeira_desalinhada",
  "aguardando_gasto_maduro",
  "amostra_madura_pequena",
  "base_financeira_bloqueada",
  "sem_diagnostico",
]);

const DESCRICOES_BLOQUEIO = Object.freeze({
  base_financeira_inconsistente: {
    categoria: "integridade",
    rotulo: "Base financeira inconsistente",
    evidenciaFaltante:
      "Reconciliar a quantidade de profissionais reconstruída pelos dias maduros de gasto com a base madura de custo.",
  },
  origem_sem_evidencia: {
    categoria: "atribuicao",
    rotulo: "Origem sem evidência",
    evidenciaFaltante:
      "Completar a evidência de origem dos cadastros que ainda estão sem origem identificável.",
  },
  atribuicao_paga_incompleta: {
    categoria: "atribuicao",
    rotulo: "Atribuição paga incompleta",
    evidenciaFaltante:
      "Levar a cobertura oficial da atribuição paga até a régua configurada antes da leitura financeira.",
  },
  cobertura_custo_incompleta: {
    categoria: "custo",
    rotulo: "Cobertura de custo incompleta",
    evidenciaFaltante:
      "Registrar gasto para todos os dias maduros que possuem profissionais oficialmente atribuídos.",
  },
  gasto_maduro_sem_profissional: {
    categoria: "atribuicao",
    rotulo: "Gasto maduro sem profissional atribuído",
    evidenciaFaltante:
      "Resolver profissionais oficialmente atribuídos nos dias maduros que já possuem gasto registrado.",
  },
  sem_base_custo: {
    categoria: "custo",
    rotulo: "Sem base de custo",
    evidenciaFaltante:
      "Produzir a janela correspondente de custo maduro para a campanha.",
  },
  sem_base_monetizacao: {
    categoria: "monetizacao",
    rotulo: "Sem base de monetização",
    evidenciaFaltante:
      "Produzir a janela correspondente de monetização para a mesma campanha e janela de recorrência.",
  },
  maturidade_financeira_desalinhada: {
    categoria: "maturidade",
    rotulo: "Maturidade financeira desalinhada",
    evidenciaFaltante:
      "Aguardar idade suficiente para custo, recorrência e monetização cobrirem a mesma coorte madura.",
  },
  aguardando_gasto_maduro: {
    categoria: "maturidade",
    rotulo: "Aguardando gasto maduro",
    evidenciaFaltante:
      "Aguardar dias de gasto completarem a maturidade exigida pela janela analisada.",
  },
  amostra_madura_pequena: {
    categoria: "amostra",
    rotulo: "Amostra madura pequena",
    evidenciaFaltante:
      "Acumular a quantidade mínima configurada de profissionais maduros na mesma base financeira.",
  },
  base_financeira_bloqueada: {
    categoria: "dados",
    rotulo: "Base financeira bloqueada",
    evidenciaFaltante:
      "Investigar o estado específico retornado pela base madura de custo antes da leitura conjunta.",
  },
  sem_diagnostico: {
    categoria: "dados",
    rotulo: "Sem diagnóstico da janela",
    evidenciaFaltante:
      "Produzir o estado de prontidão financeira da janela antes de consolidar a campanha.",
  },
});

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function texto(valor) {
  return String(valor || "").trim();
}

function prioridade(codigo) {
  const indice =
    PRIORIDADE_BLOQUEIOS.indexOf(codigo);

  return indice === -1
    ? PRIORIDADE_BLOQUEIOS.length
    : indice;
}

function descreverBloqueio(codigo) {
  const normalizado =
    texto(codigo) || "sem_diagnostico";
  const conhecido =
    DESCRICOES_BLOQUEIO[normalizado];

  if (conhecido) {
    return {
      codigo: normalizado,
      ...conhecido,
    };
  }

  return {
    codigo: normalizado,
    categoria: "dados",
    rotulo: normalizado,
    evidenciaFaltante:
      "Consultar o estado original da janela e preservar o código até que o bloqueio seja classificado explicitamente.",
  };
}

function normalizarJanela(janela = {}) {
  const codigo = texto(
    janela?.leitura?.codigo
  );
  const pronta =
    janela?.prontaParaLeituraConjunta ===
      true ||
    codigo === "leitura_conjunta_disponivel";

  return {
    janelaDias: numero(janela?.janelaDias),
    pronta,
    codigo:
      pronta
        ? "leitura_conjunta_disponivel"
        : codigo || "sem_diagnostico",
  };
}

function agruparBloqueios(janelas = []) {
  const porCodigo = new Map();

  for (const janela of janelas) {
    if (janela.pronta) continue;

    const descricao =
      descreverBloqueio(janela.codigo);

    if (!porCodigo.has(descricao.codigo)) {
      porCodigo.set(descricao.codigo, {
        ...descricao,
        janelas: [],
      });
    }

    const grupo = porCodigo.get(
      descricao.codigo
    );
    grupo.janelas.push(
      numero(janela.janelaDias)
    );
  }

  return [...porCodigo.values()]
    .map((bloqueio) => ({
      ...bloqueio,
      janelas: [...new Set(
        bloqueio.janelas
      )].sort((a, b) => a - b),
    }))
    .sort((a, b) => {
      const diferencaPrioridade =
        prioridade(a.codigo) -
        prioridade(b.codigo);

      if (diferencaPrioridade !== 0) {
        return diferencaPrioridade;
      }

      return a.codigo.localeCompare(
        b.codigo,
        "pt-BR"
      );
    });
}

function diagnosticarCampanha(campanha = {}) {
  const janelasOriginais = Array.isArray(
    campanha?.prontidaoFinanceiraRecorrencia
  )
    ? campanha.prontidaoFinanceiraRecorrencia
    : [];
  const janelas = janelasOriginais
    .map(normalizarJanela)
    .sort(
      (a, b) =>
        a.janelaDias - b.janelaDias
    );
  const janelasDisponiveis = janelas
    .filter((janela) => janela.pronta)
    .map((janela) => janela.janelaDias);
  const janelasBloqueadas = janelas
    .filter((janela) => !janela.pronta)
    .map((janela) => janela.janelaDias);
  const bloqueios =
    agruparBloqueios(janelas);

  let estado = {
    codigo: "sem_janelas",
    rotulo: "Sem janelas diagnosticadas",
  };

  if (
    janelas.length > 0 &&
    janelasBloqueadas.length === 0
  ) {
    estado = {
      codigo: "todas_janelas_disponiveis",
      rotulo:
        "Todas as janelas disponíveis",
    };
  } else if (
    janelasDisponiveis.length > 0 &&
    janelasBloqueadas.length > 0
  ) {
    estado = {
      codigo: "leitura_parcial",
      rotulo: "Leitura parcial",
    };
  } else if (janelasBloqueadas.length > 0) {
    estado = {
      codigo: "leitura_bloqueada",
      rotulo: "Leitura bloqueada",
    };
  }

  return {
    chave:
      texto(campanha?.chave) ||
      `campanha:${texto(
        campanha?.campanhaOficialId
      )}`,
    campanhaOficialId:
      texto(campanha?.campanhaOficialId),
    origem: texto(campanha?.origem),
    midia: texto(campanha?.midia),
    campanha: texto(campanha?.campanha),
    totalJanelas: janelas.length,
    janelasDisponiveis,
    janelasBloqueadas,
    estado,
    bloqueioPrincipal:
      bloqueios[0] || null,
    bloqueios,
  };
}

function criarResumoDiagnostico(
  campanhas = []
) {
  const resumo = {
    campanhas: campanhas.length,
    comLeituraCompleta: 0,
    comLeituraParcial: 0,
    bloqueadas: 0,
    semJanelas: 0,
    bloqueios: [],
  };
  const porBloqueio = new Map();

  for (const campanha of campanhas) {
    switch (campanha?.estado?.codigo) {
      case "todas_janelas_disponiveis":
        resumo.comLeituraCompleta += 1;
        break;
      case "leitura_parcial":
        resumo.comLeituraParcial += 1;
        break;
      case "leitura_bloqueada":
        resumo.bloqueadas += 1;
        break;
      default:
        resumo.semJanelas += 1;
    }

    for (const bloqueio of campanha.bloqueios) {
      if (!porBloqueio.has(bloqueio.codigo)) {
        porBloqueio.set(bloqueio.codigo, {
          codigo: bloqueio.codigo,
          categoria: bloqueio.categoria,
          rotulo: bloqueio.rotulo,
          evidenciaFaltante:
            bloqueio.evidenciaFaltante,
          campanhas: 0,
          ocorrenciasJanelas: 0,
        });
      }

      const agregado = porBloqueio.get(
        bloqueio.codigo
      );
      agregado.campanhas += 1;
      agregado.ocorrenciasJanelas +=
        bloqueio.janelas.length;
    }
  }

  resumo.bloqueios = [...porBloqueio.values()]
    .sort((a, b) => {
      const diferencaPrioridade =
        prioridade(a.codigo) -
        prioridade(b.codigo);

      if (diferencaPrioridade !== 0) {
        return diferencaPrioridade;
      }

      if (a.campanhas !== b.campanhas) {
        return b.campanhas - a.campanhas;
      }

      return a.rotulo.localeCompare(
        b.rotulo,
        "pt-BR"
      );
    });

  return resumo;
}

function enriquecerRecorrenciaComDiagnosticoExecutivo({
  recorrencia = {},
} = {}) {
  const campanhasOriginais = Array.isArray(
    recorrencia?.qualidadeCampanhasOficiais
  )
    ? recorrencia.qualidadeCampanhasOficiais
    : [];
  const campanhas = campanhasOriginais.map(
    diagnosticarCampanha
  );

  return {
    ...recorrencia,
    diagnosticoExecutivoProntidaoFinanceira: {
      campanhas,
      resumo:
        criarResumoDiagnostico(campanhas),
      metodologia:
        "o diagnóstico executivo consolida os estados de prontidão D7, D14 e D30 sem alterar seus códigos. O bloqueio principal segue precedência técnica para destacar integridade e cobertura antes de maturidade e amostra. Resultado comercial baixo ou zero não é classificado como bloqueio e nenhuma campanha recebe recomendação automática de orçamento nesta camada.",
    },
  };
}

module.exports = {
  agruparBloqueios,
  criarResumoDiagnostico,
  descreverBloqueio,
  diagnosticarCampanha,
  enriquecerRecorrenciaComDiagnosticoExecutivo,
  normalizarJanela,
};
