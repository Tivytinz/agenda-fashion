document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      form:
        document.getElementById(
          "formCriarNegocio"
        ),

      nome:
        document.getElementById(
          "nome"
        ),

      setor:
        document.getElementById(
          "setor"
        ),

      whatsapp:
        document.getElementById(
          "whatsapp"
        ),

      descricao:
        document.getElementById(
          "descricao"
        ),

      contadorDescricao:
        document.getElementById(
          "contadorDescricao"
        ),

      cep:
        document.getElementById(
          "cep"
        ),

      cidade:
        document.getElementById(
          "cidade"
        ),

      estado:
        document.getElementById(
          "estado"
        ),

      bairro:
        document.getElementById(
          "bairro"
        ),

      endereco:
        document.getElementById(
          "endereco"
        ),

      numero:
        document.getElementById(
          "numero"
        ),

      complemento:
        document.getElementById(
          "complemento"
        ),

      localizacaoUrl:
        document.getElementById(
          "localizacao_url"
        ),

      mensagem:
        document.getElementById(
          "mensagemCriacao"
        ),

      botao:
        document.getElementById(
          "btnCriarNegocio"
        ),

      btnSair:
        document.getElementById(
          "btnSair"
        ),
    };

    const obrigatorios = [
      elementos.form,
      elementos.nome,
      elementos.setor,
      elementos.whatsapp,
      elementos.descricao,
      elementos.cep,
      elementos.cidade,
      elementos.estado,
      elementos.bairro,
      elementos.endereco,
      elementos.numero,
      elementos.complemento,
      elementos.localizacaoUrl,
      elementos.mensagem,
      elementos.botao,
      elementos.btnSair,
    ];

    if (
      obrigatorios.some(
        (elemento) => !elemento
      )
    ) {
      console.error(
        "Elementos obrigatórios da criação do negócio não foram encontrados."
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.post !==
        "function"
    ) {
      console.error(
        "API não foi carregada."
      );

      mostrarMensagem(
        "O serviço da API não foi carregado. Atualize a página."
      );

      return;
    }

    if (
      !window.AuthService ||
      typeof window.AuthService
        .carregarMinhaSessao !==
        "function"
    ) {
      console.error(
        "AuthService não foi carregado."
      );

      mostrarMensagem(
        "O sistema de autenticação não foi carregado. Atualize a página."
      );

      return;
    }

    let enviando = false;
    let verificandoSessao = true;
    let temporizadorRedirecionamento =
      null;

    function normalizarTexto(
      valor
    ) {
      return String(
        valor ?? ""
      )
        .trim()
        .replace(/\s+/g, " ");
    }

    function normalizarWhatsapp(
      valor
    ) {
      let numeros =
        String(valor ?? "")
          .replace(/\D/g, "");

      if (
        (numeros.length === 12 ||
          numeros.length === 13) &&
        numeros.startsWith("55")
      ) {
        numeros =
          numeros.slice(2);
      }

      return numeros;
    }

    function normalizarCep(
      valor
    ) {
      return String(
        valor ?? ""
      ).replace(/\D/g, "");
    }

    function aplicarMascaraWhatsapp(
      valor
    ) {
      const numeros =
        normalizarWhatsapp(
          valor
        ).slice(0, 11);

      if (
        numeros.length <= 2
      ) {
        return numeros;
      }

      if (
        numeros.length <= 6
      ) {
        return (
          `(${numeros.slice(0, 2)}) ` +
          numeros.slice(2)
        );
      }

      if (
        numeros.length <= 10
      ) {
        return (
          `(${numeros.slice(0, 2)}) ` +
          `${numeros.slice(2, 6)}-` +
          numeros.slice(6)
        );
      }

      return (
        `(${numeros.slice(0, 2)}) ` +
        `${numeros.slice(2, 7)}-` +
        numeros.slice(7)
      );
    }

    function aplicarMascaraCep(
      valor
    ) {
      const numeros =
        normalizarCep(
          valor
        ).slice(0, 8);

      if (
        numeros.length <= 5
      ) {
        return numeros;
      }

      return (
        `${numeros.slice(0, 5)}-` +
        numeros.slice(5)
      );
    }

    function nomeValido() {
      const nome =
        normalizarTexto(
          elementos.nome.value
        );

      return (
        nome.length >= 2 &&
        nome.length <= 120
      );
    }

    function setorValido() {
      const setor =
        normalizarTexto(
          elementos.setor.value
        );

      return (
        setor.length >= 2 &&
        setor.length <= 80
      );
    }

    function whatsappValido() {
      return [10, 11].includes(
        normalizarWhatsapp(
          elementos.whatsapp.value
        ).length
      );
    }

    function descricaoValida() {
      return (
        elementos.descricao
          .value.length <= 1200
      );
    }

    function cepValido() {
      const cep =
        normalizarCep(
          elementos.cep.value
        );

      return (
        !cep ||
        cep.length === 8
      );
    }

    function cidadeValida() {
      const cidade =
        normalizarTexto(
          elementos.cidade.value
        );

      return (
        cidade.length >= 2 &&
        cidade.length <= 100
      );
    }

    function estadoValido() {
      return /^[A-Z]{2}$/.test(
        String(
          elementos.estado.value ||
            ""
        ).toUpperCase()
      );
    }

    function urlValida() {
      const valor =
        normalizarTexto(
          elementos
            .localizacaoUrl
            .value
        );

      if (!valor) {
        return true;
      }

      try {
        const url =
          new URL(valor);

        return [
          "http:",
          "https:",
        ].includes(
          url.protocol
        );
      } catch {
        return false;
      }
    }

    function formularioValido() {
      return (
        nomeValido() &&
        setorValido() &&
        whatsappValido() &&
        descricaoValida() &&
        cepValido() &&
        cidadeValida() &&
        estadoValido() &&
        urlValida()
      );
    }

    function limparErroCampo(
      campo
    ) {
      campo?.removeAttribute(
        "aria-invalid"
      );

      campo?.classList.remove(
        "input-error",
        "shake"
      );
    }

    function limparErros() {
      [
        elementos.nome,
        elementos.setor,
        elementos.whatsapp,
        elementos.descricao,
        elementos.cep,
        elementos.cidade,
        elementos.estado,
        elementos.bairro,
        elementos.endereco,
        elementos.numero,
        elementos.complemento,
        elementos.localizacaoUrl,
      ].forEach(
        limparErroCampo
      );
    }

    function marcarErro(
      campo
    ) {
      if (!campo) {
        return;
      }

      campo.setAttribute(
        "aria-invalid",
        "true"
      );

      campo.classList.remove(
        "shake"
      );

      void campo.offsetWidth;

      campo.classList.add(
        "input-error",
        "shake"
      );

      campo.focus();
    }

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      elementos.mensagem
        .textContent = texto;

      elementos.mensagem
        .classList.remove(
          "hidden",
          "erro",
          "sucesso"
        );

      elementos.mensagem
        .classList.add(tipo);
    }

    function esconderMensagem() {
      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .classList.add(
          "hidden"
        );

      elementos.mensagem
        .classList.remove(
          "erro",
          "sucesso"
        );
    }

    function limparEstadoBotao() {
      elementos.botao
        .classList.remove(
          "btn-success",
          "btn-error"
        );
    }

    function atualizarContador() {
      elementos.contadorDescricao
        .textContent =
          String(
            elementos.descricao
              .value.length
          );
    }

    function atualizarBotao() {
      elementos.botao.disabled =
        enviando ||
        verificandoSessao ||
        !formularioValido();

      elementos.botao
        .classList.toggle(
          "btn-disabled",
          elementos.botao.disabled
        );

      if (
        !enviando &&
        !verificandoSessao &&
        !elementos.botao
          .classList.contains(
            "btn-success"
          ) &&
        !elementos.botao
          .classList.contains(
            "btn-error"
          )
      ) {
        elementos.botao
          .textContent =
            "Criar meu negócio";
      }
    }

    function validarFormulario() {
      limparErros();

      if (!nomeValido()) {
        marcarErro(
          elementos.nome
        );

        mostrarMensagem(
          "Digite um nome de negócio válido."
        );

        return false;
      }

      if (!setorValido()) {
        marcarErro(
          elementos.setor
        );

        mostrarMensagem(
          "Selecione o segmento do negócio."
        );

        return false;
      }

      if (!whatsappValido()) {
        marcarErro(
          elementos.whatsapp
        );

        mostrarMensagem(
          "Digite um WhatsApp com DDD."
        );

        return false;
      }

      if (!descricaoValida()) {
        marcarErro(
          elementos.descricao
        );

        mostrarMensagem(
          "A descrição deve ter no máximo 1200 caracteres."
        );

        return false;
      }

      if (!cepValido()) {
        marcarErro(
          elementos.cep
        );

        mostrarMensagem(
          "Digite um CEP válido com 8 números."
        );

        return false;
      }

      if (!cidadeValida()) {
        marcarErro(
          elementos.cidade
        );

        mostrarMensagem(
          "Digite uma cidade válida."
        );

        return false;
      }

      if (!estadoValido()) {
        marcarErro(
          elementos.estado
        );

        mostrarMensagem(
          "Selecione o estado."
        );

        return false;
      }

      if (!urlValida()) {
        marcarErro(
          elementos.localizacaoUrl
        );

        mostrarMensagem(
          "Digite um link válido do Google Maps."
        );

        return false;
      }

      return true;
    }

    function definirCarregando(
      ativo
    ) {
      enviando = ativo;

      elementos.form
        .setAttribute(
          "aria-busy",
          String(ativo)
        );

      elementos.form
        .querySelectorAll(
          "input, select, textarea"
        )
        .forEach(
          (campo) => {
            campo.disabled =
              ativo;
          }
        );

      elementos.botao.disabled =
        ativo ||
        verificandoSessao ||
        !formularioValido();

      elementos.botao
        .classList.toggle(
          "btn-disabled",
          elementos.botao.disabled
        );

      if (ativo) {
        limparEstadoBotao();

        elementos.botao
          .textContent =
            "Criando negócio...";
      }
    }

    function obterFusoHorario() {
      try {
        return (
          Intl
            .DateTimeFormat()
            .resolvedOptions()
            .timeZone ||
          "America/Sao_Paulo"
        );
      } catch {
        return "America/Sao_Paulo";
      }
    }

    function montarDados() {
      return {
        nome:
          normalizarTexto(
            elementos.nome.value
          ),

        setor:
          normalizarTexto(
            elementos.setor.value
          ),

        whatsapp:
          normalizarWhatsapp(
            elementos.whatsapp.value
          ),

        descricao:
          normalizarTexto(
            elementos.descricao.value
          ) || null,

        cep:
          normalizarCep(
            elementos.cep.value
          ) || null,

        cidade:
          normalizarTexto(
            elementos.cidade.value
          ),

        estado:
          String(
            elementos.estado.value ||
              ""
          ).toUpperCase(),

        bairro:
          normalizarTexto(
            elementos.bairro.value
          ) || null,

        endereco:
          normalizarTexto(
            elementos.endereco.value
          ) || null,

        numero:
          normalizarTexto(
            elementos.numero.value
          ) || null,

        complemento:
          normalizarTexto(
            elementos.complemento.value
          ) || null,

        localizacao_url:
          normalizarTexto(
            elementos
              .localizacaoUrl
              .value
          ) || null,

        fuso_horario:
          obterFusoHorario(),
      };
    }

    function tratarCampoDoErro(
      erro
    ) {
      const mensagem =
        String(
          erro?.message || ""
        ).toLowerCase();

      if (
        mensagem.includes(
          "nome"
        )
      ) {
        marcarErro(
          elementos.nome
        );

        return;
      }

      if (
        mensagem.includes(
          "segmento"
        ) ||
        mensagem.includes(
          "setor"
        )
      ) {
        marcarErro(
          elementos.setor
        );

        return;
      }

      if (
        mensagem.includes(
          "whatsapp"
        )
      ) {
        marcarErro(
          elementos.whatsapp
        );

        return;
      }

      if (
        mensagem.includes(
          "descrição"
        )
      ) {
        marcarErro(
          elementos.descricao
        );

        return;
      }

      if (
        mensagem.includes(
          "cep"
        )
      ) {
        marcarErro(
          elementos.cep
        );

        return;
      }

      if (
        mensagem.includes(
          "cidade"
        )
      ) {
        marcarErro(
          elementos.cidade
        );

        return;
      }

      if (
        mensagem.includes(
          "estado"
        )
      ) {
        marcarErro(
          elementos.estado
        );

        return;
      }

      if (
        mensagem.includes(
          "url"
        ) ||
        mensagem.includes(
          "localização"
        )
      ) {
        marcarErro(
          elementos.localizacaoUrl
        );
      }
    }

    function redirecionar(
      destino,
      atraso = 600
    ) {
      window.clearTimeout(
        temporizadorRedirecionamento
      );

      temporizadorRedirecionamento =
        window.setTimeout(
          () => {
            window.location.href =
              destino;
          },
          atraso
        );
    }

    async function verificarSessao() {
      verificandoSessao = true;

      elementos.botao
        .textContent =
          "Verificando conta...";

      atualizarBotao();

      try {
        const contexto =
          await window.AuthService
            .carregarMinhaSessao();

        if (
          contexto.temNegocio &&
          contexto.negocio?.id
        ) {
          const destino =
            window.AuthService
              .obterDestino({
                usuario:
                  contexto.usuario,

                negocio:
                  contexto.negocio,

                destinoSemNegocio:
                  "/html/criar-negocio.html",

                destinoDono:
                  "/html/dashboard-dono.html",

                destinoProfissional:
                  "/html/agenda-profissional.html",
              });

          redirecionar(
            destino,
            0
          );

          return false;
        }

        return true;
      } catch (erro) {
        console.error(
          "Erro ao verificar sessão:",
          erro
        );

        if (
          erro?.status === 401 ||
          erro?.status === 403
        ) {
          window.AuthService
            .limparSessao();

          window.location.href =
            "/html/login-profissional.html";

          return false;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível verificar sua conta."
        );

        return false;
      } finally {
        verificandoSessao =
          false;

        atualizarBotao();
      }
    }

    async function criarNegocio(
      evento
    ) {
      evento.preventDefault();

      if (
        enviando ||
        verificandoSessao
      ) {
        return;
      }

      esconderMensagem();
      limparEstadoBotao();

      if (!validarFormulario()) {
        atualizarBotao();
        return;
      }

      definirCarregando(
        true
      );

      try {
        const resultado =
          await window.API.post(
            "/criar-negocio",
            montarDados()
          );

        if (
          !resultado?.negocio?.id
        ) {
          throw new Error(
            "O negócio foi criado, mas o servidor retornou uma resposta inválida."
          );
        }

        /*
         * Atualiza usuário, negócio e papel
         * diretamente através da sessão.
         */
        const contexto =
          await window.AuthService
            .carregarMinhaSessao();

        if (
          !contexto.negocio?.id ||
          contexto.negocio.papel !==
            "dono"
        ) {
          throw new Error(
            "O negócio foi criado, mas o vínculo de proprietário não foi carregado."
          );
        }

        mostrarMensagem(
          "Negócio criado com sucesso. Abrindo seu painel...",
          "sucesso"
        );

        elementos.botao
          .textContent =
            "Negócio criado";

        elementos.botao
          .classList.remove(
            "btn-disabled",
            "btn-error"
          );

        elementos.botao
          .classList.add(
            "btn-success"
          );

        redirecionar(
          "/html/dashboard-dono.html"
        );
      } catch (erro) {
        console.error(
          "Erro ao criar negócio:",
          erro
        );

        /*
         * Caso o negócio já exista,
         * tenta atualizar a sessão antes
         * de exibir o erro.
         */
        if (
          erro?.status === 409
        ) {
          try {
            const contexto =
              await window.AuthService
                .carregarMinhaSessao();

            if (
              contexto.negocio?.id
            ) {
              mostrarMensagem(
                "Esta conta já possui um negócio. Abrindo seu painel...",
                "sucesso"
              );

              redirecionar(
                window.AuthService
                  .obterDestino({
                    usuario:
                      contexto.usuario,

                    negocio:
                      contexto.negocio,

                    destinoDono:
                      "/html/dashboard-dono.html",

                    destinoProfissional:
                      "/html/agenda-profissional.html",
                  })
              );

              return;
            }
          } catch (
            erroSessao
          ) {
            console.error(
              "Erro ao atualizar contexto:",
              erroSessao
            );
          }
        }

        if (
          erro?.status === 401 ||
          erro?.status === 403
        ) {
          window.AuthService
            .limparSessao();

          window.location.href =
            "/html/login-profissional.html";

          return;
        }

        tratarCampoDoErro(
          erro
        );

        mostrarMensagem(
          erro?.message ||
            "Não foi possível criar o negócio."
        );

        elementos.botao
          .textContent =
            "Tentar novamente";

        elementos.botao
          .classList.remove(
            "btn-success",
            "btn-disabled"
          );

        elementos.botao
          .classList.add(
            "btn-error"
          );
      } finally {
        definirCarregando(
          false
        );

        atualizarBotao();
      }
    }

    elementos.whatsapp
      .addEventListener(
        "input",
        () => {
          elementos.whatsapp.value =
            aplicarMascaraWhatsapp(
              elementos.whatsapp.value
            );

          limparErroCampo(
            elementos.whatsapp
          );

          esconderMensagem();
          limparEstadoBotao();
          atualizarBotao();
        }
      );

    elementos.cep
      .addEventListener(
        "input",
        () => {
          elementos.cep.value =
            aplicarMascaraCep(
              elementos.cep.value
            );

          limparErroCampo(
            elementos.cep
          );

          esconderMensagem();
          limparEstadoBotao();
          atualizarBotao();
        }
      );

    elementos.descricao
      .addEventListener(
        "input",
        () => {
          atualizarContador();

          limparErroCampo(
            elementos.descricao
          );

          esconderMensagem();
          limparEstadoBotao();
          atualizarBotao();
        }
      );

    [
      elementos.nome,
      elementos.setor,
      elementos.cidade,
      elementos.estado,
      elementos.bairro,
      elementos.endereco,
      elementos.numero,
      elementos.complemento,
      elementos.localizacaoUrl,
    ].forEach(
      (campo) => {
        campo.addEventListener(
          "input",
          () => {
            limparErroCampo(
              campo
            );

            esconderMensagem();
            limparEstadoBotao();
            atualizarBotao();
          }
        );

        campo.addEventListener(
          "change",
          () => {
            limparErroCampo(
              campo
            );

            esconderMensagem();
            limparEstadoBotao();
            atualizarBotao();
          }
        );
      }
    );

    elementos.form
      .addEventListener(
        "submit",
        criarNegocio
      );

    elementos.btnSair
      .addEventListener(
        "click",
        () => {
          window.AuthService.logout(
            "/html/login-profissional.html"
          );
        }
      );

    atualizarContador();
    atualizarBotao();

    const sessaoValida =
      await verificarSessao();

    if (sessaoValida) {
      elementos.nome.focus();
    }

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          temporizadorRedirecionamento
        );
      }
    );
  }
);