(function configurarAnalytics(
  window,
  document
) {
  const CHAVE_SESSAO =
    "af_produto_sessao";

  const FILA_MAXIMA =
    30;

  const CHAVES_PROPRIEDADES =
    new Set([
      "acao",
      "agendamentos_mes",
      "categoria",
      "faixa",
      "origem",
      "papel",
      "periodo",
      "resultados",
      "servico_id",
      "status",
      "termo_presente",
    ]);

  const fila = [];

  let enviando =
    false;

  function normalizarTexto(
    valor,
    limite = 60
  ) {
    return String(
      valor ?? ""
    )
      .trim()
      .slice(
        0,
        limite
      );
  }

  function criarIdSessao() {
    const uuid =
      window.crypto
        ?.randomUUID?.();

    if (uuid) {
      return uuid
        .replace(
          /-/g,
          ""
        )
        .slice(
          0,
          32
        );
    }

    return (
      Date.now()
        .toString(36) +
      Math.random()
        .toString(36)
        .slice(2) +
      Math.random()
        .toString(36)
        .slice(2)
    ).slice(
      0,
      32
    );
  }

  function obterIdSessao() {
    try {
      const atual =
        sessionStorage
          .getItem(
            CHAVE_SESSAO
          );

      if (
        /^[A-Za-z0-9_-]{8,64}$/
          .test(
            atual || ""
          )
      ) {
        return atual;
      }

      const novo =
        criarIdSessao();

      sessionStorage
        .setItem(
          CHAVE_SESSAO,
          novo
        );

      return novo;
    } catch {
      return criarIdSessao();
    }
  }

  function obterApiUrl() {
    const configurada =
      window.AF_CONFIG
        ?.API_URL ||
      window.API_URL ||
      window.location.origin;

    return normalizarTexto(
      configurada,
      300
    ).replace(
      /\/+$/,
      ""
    );
  }

  function obterContextoTela() {
    const dataset =
      document.body
        ?.dataset ||
      {};

    return {
      pagina:
        normalizarTexto(
          dataset.afTela ||
          "landing"
        ),
      missao:
        normalizarTexto(
          dataset.afMissao ||
          ""
        ),
    };
  }

  function obterNegocioId(
    informado
  ) {
    const numeroInformado =
      Number(informado);

    if (
      Number.isInteger(
        numeroInformado
      ) &&
      numeroInformado > 0
    ) {
      return numeroInformado;
    }

    try {
      const negocio =
        JSON.parse(
          localStorage.getItem(
            "negocio"
          ) ||
          "null"
        );

      const numero =
        Number(
          negocio?.id ||
          negocio?.negocio_id
        );

      return Number.isInteger(
        numero
      ) &&
      numero > 0
        ? numero
        : null;
    } catch {
      return null;
    }
  }

  function sanitizarPropriedades(
    propriedades
  ) {
    if (
      !propriedades ||
      typeof propriedades !==
        "object" ||
      Array.isArray(
        propriedades
      )
    ) {
      return {};
    }

    const resultado = {};

    Object.entries(
      propriedades
    )
      .slice(
        0,
        12
      )
      .forEach(
        ([
          chave,
          valor,
        ]) => {
          const chaveNormalizada =
            normalizarTexto(
              chave,
              40
            );

          if (
            !/^[a-z0-9_]+$/
              .test(
                chaveNormalizada
              ) ||
            !CHAVES_PROPRIEDADES
              .has(
                chaveNormalizada
              )
          ) {
            return;
          }

          if (
            typeof valor ===
              "boolean" ||
            (
              typeof valor ===
                "number" &&
              Number.isFinite(
                valor
              )
            )
          ) {
            resultado[
              chaveNormalizada
            ] = valor;

            return;
          }

          if (
            typeof valor ===
              "string"
          ) {
            resultado[
              chaveNormalizada
            ] =
              normalizarTexto(
                valor
              );
          }
        }
      );

    return resultado;
  }

  function criarEvento(
    nome,
    opcoes = {}
  ) {
    const contexto =
      obterContextoTela();

    return {
      nome:
        normalizarTexto(
          nome
        ),
      pagina:
        normalizarTexto(
          opcoes.pagina ||
          contexto.pagina
        ),
      missao:
        normalizarTexto(
          opcoes.missao ||
          contexto.missao
        ) ||
        undefined,
      sessao_id:
        obterIdSessao(),
      negocio_id:
        obterNegocioId(
          opcoes.negocioId
        ) ||
        undefined,
      propriedades:
        sanitizarPropriedades(
          opcoes.propriedades
        ),
    };
  }

  async function enviarProximo() {
    if (
      enviando ||
      fila.length === 0
    ) {
      return;
    }

    enviando =
      true;

    const evento =
      fila.shift();

    const headers = {
      "Content-Type":
        "application/json",
      Accept:
        "application/json",
    };

    try {
      const token =
        localStorage.getItem(
          "token"
        );

      if (token) {
        headers.Authorization =
          `Bearer ${token}`;
      }

      await window.fetch(
        `${obterApiUrl()}/eventos-produto`,
        {
          method:
            "POST",
          headers,
          body:
            JSON.stringify(
              evento
            ),
          keepalive:
            true,
          credentials:
            "omit",
        }
      );
    } catch {
      /*
       * Métricas nunca podem bloquear
       * a missão principal da tela.
       */
    } finally {
      enviando =
        false;

      if (
        fila.length > 0
      ) {
        void enviarProximo();
      }
    }
  }

  function registrar(
    nome,
    opcoes = {}
  ) {
    if (
      fila.length >=
      FILA_MAXIMA
    ) {
      fila.shift();
    }

    const evento =
      criarEvento(
        nome,
        opcoes
      );

    fila.push(
      evento
    );

    window.dispatchEvent(
      new CustomEvent(
        "agenda-fashion:evento",
        {
          detail:
            evento,
        }
      )
    );

    if (
      typeof window.gtag ===
        "function"
    ) {
      window.gtag(
        "event",
        evento.nome,
        {
          pagina:
            evento.pagina,
          missao:
            evento.missao,
          ...evento
            .propriedades,
        }
      );
    }

    void enviarProximo();
  }

  window.AFAnalytics = {
    registrar,
  };

  function registrarTela() {
    const contexto =
      obterContextoTela();

    registrar(
      "tela_visualizada",
      {
        pagina:
          contexto.pagina,
        missao:
          contexto.missao,
      }
    );
  }

  if (
    document.readyState ===
      "loading"
  ) {
    document
      .addEventListener(
        "DOMContentLoaded",
        registrarTela,
        {
          once:
            true,
        }
      );
  } else {
    registrarTela();
  }
})(
  window,
  document
);
