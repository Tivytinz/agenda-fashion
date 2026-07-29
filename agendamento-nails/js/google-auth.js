(function configurarGoogleAuth(
  window,
  document
) {
  const seletor =
    "[data-google-auth]";
  let iniciado = false;

  function obterMensagem() {
    return document.querySelector(
      ".mensagem-form"
    );
  }

  function mostrarMensagem(
    texto,
    tipo = "erro"
  ) {
    const mensagem =
      obterMensagem();

    if (!mensagem) {
      return;
    }

    mensagem.textContent = texto;
    mensagem.classList.remove(
      "hidden",
      "erro",
      "sucesso"
    );
    mensagem.classList.add(tipo);
  }

  function definirCarregando(
    container,
    carregando
  ) {
    container.setAttribute(
      "aria-busy",
      String(carregando)
    );

    container.classList.toggle(
      "google-auth-loading",
      carregando
    );
  }

  function obterDestino(
    container,
    resultado
  ) {
    if (
      localStorage.getItem(
        "agendamentoPendente"
      )
    ) {
      return "/html/finalizar-agendamento.html";
    }

    const profissional =
      container.dataset
        .googleContexto ===
      "profissional";

    return window.AuthService
      .obterDestino({
        usuario:
          resultado.usuario,
        negocio:
          resultado.negocio,
        destinoSemNegocio:
          profissional
            ? "/html/criar-negocio.html"
            : "/html/inicio.html",
        destinoDono:
          "/html/dashboard-dono.html",
        destinoProfissional:
          "/html/agenda-profissional.html",
        destinoLogin:
          profissional
            ? "/html/login-profissional.html"
            : "/html/login-cliente.html",
      });
  }

  function redirecionar(destino) {
    document.body.classList.add(
      "page-exit"
    );

    window.setTimeout(() => {
      window.location.href =
        destino;
    }, 250);
  }

  async function autenticar(
    container,
    respostaGoogle
  ) {
    definirCarregando(
      container,
      true
    );

    try {
      const resultado =
        await window.AuthService
          .loginGoogle(
            respostaGoogle
              ?.credential
          );

      mostrarMensagem(
        resultado.contaCriada
          ? "Conta criada com Google. Bem-vinda ao Agenda Fashion!"
          : "Login com Google realizado com sucesso.",
        "sucesso"
      );

      window.AFAnalytics
        ?.registrar?.(
          "autenticacao_google_sucesso",
          {
            contaCriada:
              Boolean(
                resultado
                  .contaCriada
              ),
          }
        );

      redirecionar(
        obterDestino(
          container,
          resultado
        )
      );
    } catch (erro) {
      console.error(
        "Erro na autenticação Google:",
        erro
      );

      mostrarMensagem(
        erro?.message ||
          "Não foi possível entrar com o Google."
      );

      window.AFAnalytics
        ?.registrar?.(
          "autenticacao_google_erro"
        );
    } finally {
      definirCarregando(
        container,
        false
      );
    }
  }

  async function iniciar() {
    if (iniciado) {
      return;
    }

    const containers = [
      ...document.querySelectorAll(
        seletor
      ),
    ];

    if (!containers.length) {
      return;
    }

    if (!window.google?.accounts?.id) {
      const script =
        document.getElementById(
          "googleIdentityScript"
        );

      if (script) {
        script.addEventListener(
          "load",
          iniciar,
          { once: true }
        );

        script.addEventListener(
          "error",
          () => {
            containers.forEach(
              (container) => {
                container.hidden =
                  true;
              }
            );
          },
          { once: true }
        );
      }

      return;
    }

    if (
      !window.AuthService ||
      typeof window.AuthService
        .loginGoogle !==
        "function"
    ) {
      containers.forEach(
        (container) => {
          container.hidden = true;
        }
      );

      return;
    }

    iniciado = true;

    try {
      const configuracao =
        await window.API.get(
          "/auth/configuracao-publica"
        );

      const clientId = String(
        configuracao
          ?.googleClientId ||
          ""
      ).trim();

      if (!clientId) {
        throw new Error(
          "Login com Google indisponível."
        );
      }

      window.google.accounts.id
        .initialize({
          client_id: clientId,
          callback:
            (resposta) =>
              autenticar(
                containers[0],
                resposta
              ),
          use_fedcm_for_prompt:
            true,
        });

      containers.forEach(
        (container) => {
          window.google.accounts.id
            .renderButton(
              container,
              {
                type: "standard",
                theme: "outline",
                size: "large",
                text:
                  "continue_with",
                shape:
                  "rectangular",
                logo_alignment:
                  "left",
                width:
                  Math.min(
                    container
                      .clientWidth ||
                      384,
                    400
                  ),
                locale: "pt-BR",
              }
            );
        }
      );
    } catch (erro) {
      console.error(
        "Erro ao iniciar Google Identity Services:",
        erro
      );

      containers.forEach(
        (container) => {
          container.hidden = true;
        }
      );
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      iniciar
    );
  } else {
    iniciar();
  }
})(window, document);
