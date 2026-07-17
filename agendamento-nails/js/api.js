(function configurarApi(window) {
  const TEMPO_LIMITE_PADRAO = 15000;

  function obterApiUrl() {
    if (
      typeof window.API_URL !== "string" ||
      !window.API_URL.trim()
    ) {
      throw new Error(
        "A URL da API não está configurada."
      );
    }

    return window.API_URL
      .trim()
      .replace(/\/+$/, "");
  }

  function montarUrl(caminho) {
    const baseUrl = obterApiUrl();

    const caminhoNormalizado =
      String(caminho ?? "").trim();

    if (!caminhoNormalizado) {
      return baseUrl;
    }

    return (
      baseUrl +
      (caminhoNormalizado.startsWith("/")
        ? caminhoNormalizado
        : `/${caminhoNormalizado}`)
    );
  }

  function obterToken() {
    return String(
      localStorage.getItem("token") || ""
    ).trim();
  }

  function limparSessaoInvalida() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");
  }

  function prepararCorpo(
    corpo,
    headers
  ) {
    if (
      corpo === undefined ||
      corpo === null
    ) {
      return undefined;
    }

    if (
      corpo instanceof FormData ||
      corpo instanceof Blob ||
      corpo instanceof ArrayBuffer ||
      corpo instanceof URLSearchParams ||
      typeof corpo === "string"
    ) {
      return corpo;
    }

    if (
      !headers.has("Content-Type")
    ) {
      headers.set(
        "Content-Type",
        "application/json"
      );
    }

    return JSON.stringify(corpo);
  }

  async function lerResposta(
    resposta
  ) {
    if (
      resposta.status === 204 ||
      resposta.status === 205
    ) {
      return null;
    }

    const contentType =
      resposta.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      return resposta
        .json()
        .catch(() => ({}));
    }

    const texto =
      await resposta
        .text()
        .catch(() => "");

    if (!texto) {
      return {};
    }

    return {
      mensagem: texto,
    };
  }

  function criarErroHttp(
    resposta,
    dados
  ) {
    const mensagem =
      dados?.erro ||
      dados?.mensagem ||
      `Erro na requisição (${resposta.status}).`;

    const erro =
      new Error(mensagem);

    erro.name =
      "ApiError";

    erro.status =
      resposta.status;

    erro.statusText =
      resposta.statusText;

    erro.dados =
      dados;

    return erro;
  }

  async function request(
    caminho,
    options = {}
  ) {
    const {
      headers:
        headersInformados = {},

      body,

      timeout =
        TEMPO_LIMITE_PADRAO,

      signal:
        signalExterno,

      ...fetchOptions
    } = options;

    const headers =
      new Headers(
        headersInformados
      );

    if (
      !headers.has("Accept")
    ) {
      headers.set(
        "Accept",
        "application/json"
      );
    }

    const token =
      obterToken();

    if (
      token &&
      !headers.has(
        "Authorization"
      )
    ) {
      headers.set(
        "Authorization",
        `Bearer ${token}`
      );
    }

    const controlador =
      new AbortController();

    let abortadoPorTimeout =
      false;

    let removerEventoAbort =
      null;

    if (signalExterno) {
      const cancelar =
        () => {
          controlador.abort();
        };

      if (
        signalExterno.aborted
      ) {
        cancelar();
      } else {
        signalExterno
          .addEventListener(
            "abort",
            cancelar,
            {
              once: true,
            }
          );

        removerEventoAbort =
          () => {
            signalExterno
              .removeEventListener(
                "abort",
                cancelar
              );
          };
      }
    }

    const tempoLimite =
      Number.isFinite(
        Number(timeout)
      ) &&
      Number(timeout) > 0
        ? Number(timeout)
        : TEMPO_LIMITE_PADRAO;

    const temporizador =
      window.setTimeout(
        () => {
          abortadoPorTimeout =
            true;

          controlador.abort();
        },
        tempoLimite
      );

    try {
      const resposta =
        await fetch(
          montarUrl(caminho),
          {
            ...fetchOptions,

            headers,

            body:
              prepararCorpo(
                body,
                headers
              ),

            signal:
              controlador.signal,
          }
        );

      const dados =
        await lerResposta(
          resposta
        );

      if (!resposta.ok) {
        /*
         * Só limpa a sessão quando
         * já existia um token enviado.
         *
         * Assim, um erro normal de login
         * não interfere no armazenamento.
         */
        if (
          resposta.status === 401 &&
          token
        ) {
          limparSessaoInvalida();
        }

        throw criarErroHttp(
          resposta,
          dados
        );
      }

      return dados;
    } catch (erro) {
      if (
        erro.name ===
        "AbortError"
      ) {
        if (
          abortadoPorTimeout
        ) {
          const erroTimeout =
            new Error(
              "A solicitação demorou demais. Verifique sua conexão e tente novamente."
            );

          erroTimeout.name =
            "TimeoutError";

          throw erroTimeout;
        }

        const erroCancelamento =
          new Error(
            "A solicitação foi cancelada."
          );

        erroCancelamento.name =
          "AbortError";

        throw erroCancelamento;
      }

      if (
        erro.name ===
        "ApiError"
      ) {
        throw erro;
      }

      console.error(
        "Erro de comunicação com a API:",
        erro
      );

      const erroConexao =
        new Error(
          "Não foi possível conectar ao servidor."
        );

      erroConexao.name =
        "NetworkError";

      throw erroConexao;
    } finally {
      window.clearTimeout(
        temporizador
      );

      removerEventoAbort?.();
    }
  }

  window.API = {
    request,

    get(
      caminho,
      options = {}
    ) {
      return request(
        caminho,
        {
          ...options,
          method: "GET",
        }
      );
    },

    post(
      caminho,
      body,
      options = {}
    ) {
      return request(
        caminho,
        {
          ...options,
          method: "POST",
          body,
        }
      );
    },

    put(
      caminho,
      body,
      options = {}
    ) {
      return request(
        caminho,
        {
          ...options,
          method: "PUT",
          body,
        }
      );
    },

    patch(
      caminho,
      body,
      options = {}
    ) {
      return request(
        caminho,
        {
          ...options,
          method: "PATCH",
          body,
        }
      );
    },

    delete(
      caminho,
      options = {}
    ) {
      return request(
        caminho,
        {
          ...options,
          method: "DELETE",
        }
      );
    },
  };
})(window);