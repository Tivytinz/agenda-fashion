document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      fotoUsuario:
        document.getElementById(
          "fotoUsuario"
        ),

      inputFotoUsuario:
        document.getElementById(
          "inputFotoUsuario"
        ),

      btnTrocarFoto:
        document.getElementById(
          "btnTrocarFoto"
        ),

      formConta:
        document.getElementById(
          "formConta"
        ),

      nomeUsuario:
        document.getElementById(
          "nomeUsuario"
        ),

      emailUsuario:
        document.getElementById(
          "emailUsuario"
        ),

      whatsappUsuario:
        document.getElementById(
          "whatsappUsuario"
        ),

      formSenha:
        document.getElementById(
          "formSenha"
        ),

      senhaAtual:
        document.getElementById(
          "senhaAtual"
        ),

      novaSenha:
        document.getElementById(
          "novaSenha"
        ),

      btnLogout:
        document.getElementById(
          "btnLogout"
        ),

      mensagem:
        document.getElementById(
          "mensagemConfig"
        ),
    };

    elementos.btnSalvarConta =
      elementos.formConta
        ?.querySelector(
          'button[type="submit"]'
        );

    elementos.btnAlterarSenha =
      elementos.formSenha
        ?.querySelector(
          'button[type="submit"]'
        );

    const obrigatorios = [
      elementos.formConta,
      elementos.nomeUsuario,
      elementos.emailUsuario,
      elementos.whatsappUsuario,
      elementos.formSenha,
      elementos.senhaAtual,
      elementos.novaSenha,
      elementos.mensagem,
    ];

    if (
      obrigatorios.some(
        (elemento) => !elemento
      )
    ) {
      console.error(
        "Elementos obrigatórios da página Minha conta não foram encontrados."
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.get !==
        "function" ||
      typeof window.API.put !==
        "function" ||
      typeof window.API.post !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço da API não foi carregado."
      );

      return;
    }

    if (
      !window.AuthService ||
      typeof window.AuthService
        .limparSessao !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço de autenticação não foi carregado."
      );

      return;
    }

    if (
      !window.SessionGuard ||
      typeof window.SessionGuard
        .exigirConta !==
        "function"
    ) {
      window.location.replace(
        "/html/login-cliente.html"
      );

      return;
    }

    const estado = {
      contexto: null,
      usuario: null,
      carregandoConta: false,
      salvandoConta: false,
      alterandoSenha: false,
      enviandoFoto: false,
      temporizadorMensagem: null,
      urlPreview: null,
    };

    const TIPOS_IMAGEM =
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);

    const TAMANHO_MAXIMO_FOTO =
      5 * 1024 * 1024;

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
        (
          numeros.length === 12 ||
          numeros.length === 13
        ) &&
        numeros.startsWith("55")
      ) {
        numeros =
          numeros.slice(2);
      }

      return numeros;
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

    function nomeValido(
      valor
    ) {
      const nome =
        normalizarTexto(valor);

      return (
        nome.length >= 2 &&
        nome.length <= 120
      );
    }

    function whatsappValido(
      valor
    ) {
      return [10, 11].includes(
        normalizarWhatsapp(
          valor
        ).length
      );
    }

    function senhaValida(
      valor
    ) {
      const tamanho =
        String(valor ?? "")
          .length;

      return (
        tamanho >= 6 &&
        tamanho <= 72
      );
    }

    function obterIniciais(
      nome
    ) {
      const partes =
        normalizarTexto(nome)
          .split(" ")
          .filter(Boolean)
          .slice(0, 2);

      const iniciais =
        partes
          .map(
            (parte) =>
              parte
                .charAt(0)
                .toUpperCase()
          )
          .join("");

      return (
        iniciais
          .replace(
            /[^A-ZÀ-Ú0-9]/g,
            ""
          )
          .slice(0, 2) ||
        "AF"
      );
    }

    function criarAvatarPadrao(
      nome
    ) {
      const iniciais =
        obterIniciais(nome);

      const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="240"
          height="240"
          viewBox="0 0 240 240"
        >
          <rect
            width="240"
            height="240"
            rx="120"
            fill="#d667a8"
          />

          <text
            x="120"
            y="136"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="78"
            font-weight="700"
            fill="#ffffff"
          >
            ${iniciais}
          </text>
        </svg>
      `;

      return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
      );
    }

    function definirFoto(
      url,
      nome
    ) {
      if (
        !elementos.fotoUsuario
      ) {
        return;
      }

      const fallback =
        criarAvatarPadrao(nome);

      elementos.fotoUsuario
        .onerror = () => {
          elementos.fotoUsuario
            .onerror = null;

          elementos.fotoUsuario
            .src = fallback;
        };

      elementos.fotoUsuario.src =
        String(url || "").trim() ||
        fallback;

      elementos.fotoUsuario.alt =
        `Foto de ${normalizarTexto(
          nome
        ) || "usuário"}`;
    }

    function mostrarMensagem(
      texto,
      tipo = "erro",
      esconderDepois = false
    ) {
      window.clearTimeout(
        estado.temporizadorMensagem
      );

      elementos.mensagem
        .textContent =
          String(texto || "");

      elementos.mensagem
        .classList.remove(
          "hidden",
          "erro",
          "sucesso"
        );

      elementos.mensagem
        .classList.add(tipo);

      elementos.mensagem
        .dataset.tipo =
          tipo;

      elementos.mensagem
        .style.color =
          tipo === "sucesso"
            ? "#2f9e63"
            : "#e63946";

      if (
        esconderDepois
      ) {
        estado.temporizadorMensagem =
          window.setTimeout(
            esconderMensagem,
            3500
          );
      }
    }

    function esconderMensagem() {
      window.clearTimeout(
        estado.temporizadorMensagem
      );

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

      elementos.mensagem
        .removeAttribute(
          "data-tipo"
        );

      elementos.mensagem
        .style.removeProperty(
          "color"
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

    function salvarUsuarioLocal(
      usuario
    ) {
      if (
        !usuario?.id
      ) {
        return;
      }

      localStorage.setItem(
        "usuario",
        JSON.stringify(
          usuario
        )
      );

      estado.usuario =
        usuario;
    }

    function redirecionarLogin() {
      window.AuthService
        .limparSessao();

      window.location.replace(
        "/html/login-cliente.html"
      );
    }

    function tratarErroSessao(
      erro
    ) {
      if (
        erro?.status === 401 ||
        erro?.status === 403
      ) {
        redirecionarLogin();

        return true;
      }

      return false;
    }

    function preencherFormulario(
      usuario
    ) {
      elementos.nomeUsuario.value =
        usuario?.nome || "";

      elementos.emailUsuario.value =
        usuario?.email || "";

      elementos.emailUsuario
        .readOnly = true;

      elementos.whatsappUsuario.value =
        aplicarMascaraWhatsapp(
          usuario?.whatsapp
        );

      definirFoto(
        usuario?.foto_url,
        usuario?.nome
      );
    }

    function definirCarregandoConta(
      ativo
    ) {
      estado.carregandoConta =
        ativo;

      elementos.formConta
        .setAttribute(
          "aria-busy",
          String(ativo)
        );

      [
        elementos.nomeUsuario,
        elementos.whatsappUsuario,
      ].forEach(
        (campo) => {
          campo.disabled =
            ativo;
        }
      );

      if (
        elementos.btnSalvarConta
      ) {
        elementos.btnSalvarConta
          .disabled =
            ativo ||
            estado.salvandoConta;

        elementos.btnSalvarConta
          .textContent =
            ativo
              ? "Carregando..."
              : "Salvar alterações";
      }
    }

    function definirSalvandoConta(
      ativo
    ) {
      estado.salvandoConta =
        ativo;

      elementos.nomeUsuario.disabled =
        ativo;

      elementos.whatsappUsuario
        .disabled =
          ativo;

      if (
        elementos.btnSalvarConta
      ) {
        elementos.btnSalvarConta
          .disabled =
            ativo;

        elementos.btnSalvarConta
          .textContent =
            ativo
              ? "Salvando..."
              : "Salvar alterações";
      }
    }

    function definirAlterandoSenha(
      ativo
    ) {
      estado.alterandoSenha =
        ativo;

      elementos.senhaAtual.disabled =
        ativo;

      elementos.novaSenha.disabled =
        ativo;

      if (
        elementos.btnAlterarSenha
      ) {
        elementos.btnAlterarSenha
          .disabled =
            ativo;

        elementos.btnAlterarSenha
          .textContent =
            ativo
              ? "Alterando..."
              : "Alterar senha";
      }
    }

    function definirEnviandoFoto(
      ativo
    ) {
      estado.enviandoFoto =
        ativo;

      if (
        elementos.inputFotoUsuario
      ) {
        elementos.inputFotoUsuario
          .disabled =
            ativo;
      }

      if (
        elementos.btnTrocarFoto
      ) {
        elementos.btnTrocarFoto
          .disabled =
            ativo;

        elementos.btnTrocarFoto
          .textContent =
            ativo
              ? "Enviando..."
              : "Trocar foto";
      }
    }

    function validarDadosConta() {
      limparErroCampo(
        elementos.nomeUsuario
      );

      limparErroCampo(
        elementos.whatsappUsuario
      );

      if (
        !nomeValido(
          elementos.nomeUsuario
            .value
        )
      ) {
        marcarErro(
          elementos.nomeUsuario
        );

        mostrarMensagem(
          "Digite um nome válido."
        );

        return false;
      }

      if (
        !whatsappValido(
          elementos.whatsappUsuario
            .value
        )
      ) {
        marcarErro(
          elementos.whatsappUsuario
        );

        mostrarMensagem(
          "Digite um WhatsApp válido com DDD."
        );

        return false;
      }

      return true;
    }

    function validarDadosSenha() {
      limparErroCampo(
        elementos.senhaAtual
      );

      limparErroCampo(
        elementos.novaSenha
      );

      if (
        !elementos.senhaAtual
          .value
      ) {
        marcarErro(
          elementos.senhaAtual
        );

        mostrarMensagem(
          "Informe a senha atual."
        );

        return false;
      }

      if (
        !senhaValida(
          elementos.novaSenha
            .value
        )
      ) {
        marcarErro(
          elementos.novaSenha
        );

        mostrarMensagem(
          "A nova senha deve ter entre 6 e 72 caracteres."
        );

        return false;
      }

      if (
        elementos.senhaAtual
          .value ===
        elementos.novaSenha
          .value
      ) {
        marcarErro(
          elementos.novaSenha
        );

        mostrarMensagem(
          "A nova senha deve ser diferente da senha atual."
        );

        return false;
      }

      return true;
    }

    function validarArquivoFoto(
      arquivo
    ) {
      if (!arquivo) {
        throw new Error(
          "Selecione uma imagem."
        );
      }

      if (
        !TIPOS_IMAGEM.has(
          String(
            arquivo.type || ""
          ).toLowerCase()
        )
      ) {
        throw new Error(
          "Envie uma imagem JPG, PNG ou WEBP."
        );
      }

      if (
        arquivo.size >
        TAMANHO_MAXIMO_FOTO
      ) {
        throw new Error(
          "A imagem deve ter no máximo 5 MB."
        );
      }

      if (
        arquivo.size <= 0
      ) {
        throw new Error(
          "A imagem selecionada está vazia."
        );
      }

      return arquivo;
    }

    function mostrarPreviewFoto(
      arquivo
    ) {
      if (
        !elementos.fotoUsuario
      ) {
        return;
      }

      if (
        estado.urlPreview
      ) {
        URL.revokeObjectURL(
          estado.urlPreview
        );
      }

      estado.urlPreview =
        URL.createObjectURL(
          arquivo
        );

      elementos.fotoUsuario.src =
        estado.urlPreview;
    }

    async function carregarMinhaConta() {
      if (
        estado.carregandoConta
      ) {
        return;
      }

      definirCarregandoConta(
        true
      );

      esconderMensagem();

      try {
        const resultado =
          await window.API.get(
            "/conta"
          );

        if (
          !resultado?.usuario?.id
        ) {
          throw new Error(
            "O servidor retornou dados inválidos da conta."
          );
        }

        estado.usuario =
          resultado.usuario;

        preencherFormulario(
          estado.usuario
        );

        salvarUsuarioLocal(
          estado.usuario
        );
      } catch (erro) {
        console.error(
          "Erro ao carregar conta:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível carregar sua conta."
        );
      } finally {
        definirCarregandoConta(
          false
        );
      }
    }

    async function salvarConta(
      evento
    ) {
      evento.preventDefault();

      if (
        estado.salvandoConta
      ) {
        return;
      }

      esconderMensagem();

      if (
        !validarDadosConta()
      ) {
        return;
      }

      definirSalvandoConta(
        true
      );

      try {
        const resultado =
          await window.API.put(
            "/conta",
            {
              nome:
                normalizarTexto(
                  elementos.nomeUsuario
                    .value
                ),

              whatsapp:
                normalizarWhatsapp(
                  elementos.whatsappUsuario
                    .value
                ),
            }
          );

        if (
          !resultado?.usuario?.id
        ) {
          throw new Error(
            "A conta foi atualizada, mas o servidor retornou dados inválidos."
          );
        }

        preencherFormulario(
          resultado.usuario
        );

        salvarUsuarioLocal(
          resultado.usuario
        );

        mostrarMensagem(
          resultado?.mensagem ||
            "Conta atualizada com sucesso.",
          "sucesso",
          true
        );
      } catch (erro) {
        console.error(
          "Erro ao salvar conta:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        const mensagem =
          erro?.message ||
          "Não foi possível atualizar sua conta.";

        if (
          mensagem
            .toLowerCase()
            .includes("nome")
        ) {
          marcarErro(
            elementos.nomeUsuario
          );
        }

        if (
          mensagem
            .toLowerCase()
            .includes("whatsapp")
        ) {
          marcarErro(
            elementos.whatsappUsuario
          );
        }

        mostrarMensagem(
          mensagem
        );
      } finally {
        definirSalvandoConta(
          false
        );
      }
    }

    async function alterarSenha(
      evento
    ) {
      evento.preventDefault();

      if (
        estado.alterandoSenha
      ) {
        return;
      }

      esconderMensagem();

      if (
        !validarDadosSenha()
      ) {
        return;
      }

      definirAlterandoSenha(
        true
      );

      try {
        const resultado =
          await window.API.put(
            "/conta/senha",
            {
              senhaAtual:
                elementos.senhaAtual
                  .value,

              novaSenha:
                elementos.novaSenha
                  .value,
            }
          );

        elementos.formSenha
          .reset();

        mostrarMensagem(
          resultado?.mensagem ||
            "Senha alterada com sucesso.",
          "sucesso",
          true
        );
      } catch (erro) {
        console.error(
          "Erro ao alterar senha:",
          erro
        );

        /*
         * Um 401 nesta rota também pode
         * significar senha atual incorreta.
         * Portanto, exibimos a mensagem
         * em vez de redirecionar imediatamente.
         */
        if (
          erro?.status === 403
        ) {
          redirecionarLogin();

          return;
        }

        const mensagem =
          erro?.message ||
          "Não foi possível alterar sua senha.";

        if (
          mensagem
            .toLowerCase()
            .includes(
              "senha atual"
            )
        ) {
          marcarErro(
            elementos.senhaAtual
          );
        } else {
          marcarErro(
            elementos.novaSenha
          );
        }

        mostrarMensagem(
          mensagem
        );
      } finally {
        definirAlterandoSenha(
          false
        );
      }
    }

    async function enviarFotoUsuario() {
      if (
        estado.enviandoFoto
      ) {
        return;
      }

      esconderMensagem();

      let arquivo;

      try {
        arquivo =
          validarArquivoFoto(
            elementos
              .inputFotoUsuario
              ?.files?.[0]
          );
      } catch (erro) {
        mostrarMensagem(
          erro.message
        );

        if (
          elementos.inputFotoUsuario
        ) {
          elementos.inputFotoUsuario
            .value = "";
        }

        return;
      }

      mostrarPreviewFoto(
        arquivo
      );

      definirEnviandoFoto(
        true
      );

      try {
        const formData =
          new FormData();

        formData.append(
          "foto",
          arquivo
        );

        const resultado =
          await window.API.post(
            "/conta/foto",
            formData
          );

        const fotoUrl =
          resultado?.foto ||
          resultado?.usuario
            ?.foto_url;

        if (!fotoUrl) {
          throw new Error(
            "A foto foi enviada, mas o servidor não retornou sua URL."
          );
        }

        const usuarioAtualizado = {
          ...(estado.usuario || {}),
          ...(resultado.usuario || {}),
          foto_url:
            fotoUrl,
        };

        salvarUsuarioLocal(
          usuarioAtualizado
        );

        definirFoto(
          fotoUrl,
          usuarioAtualizado.nome
        );

        mostrarMensagem(
          resultado?.mensagem ||
            "Foto atualizada com sucesso.",
          "sucesso",
          true
        );
      } catch (erro) {
        console.error(
          "Erro ao enviar foto:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        definirFoto(
          estado.usuario?.foto_url,
          estado.usuario?.nome
        );

        mostrarMensagem(
          erro?.message ||
            "Não foi possível enviar a foto."
        );
      } finally {
        definirEnviandoFoto(
          false
        );

        if (
          elementos.inputFotoUsuario
        ) {
          elementos.inputFotoUsuario
            .value = "";
        }

        if (
          estado.urlPreview
        ) {
          URL.revokeObjectURL(
            estado.urlPreview
          );

          estado.urlPreview =
            null;
        }
      }
    }

    function sair() {
      window.AuthService
        .limparSessao();

      window.location.replace(
        "/html/inicio.html"
      );
    }

    elementos.whatsappUsuario
      .addEventListener(
        "input",
        () => {
          elementos.whatsappUsuario
            .value =
              aplicarMascaraWhatsapp(
                elementos.whatsappUsuario
                  .value
              );

          limparErroCampo(
            elementos.whatsappUsuario
          );

          esconderMensagem();
        }
      );

    elementos.nomeUsuario
      .addEventListener(
        "input",
        () => {
          limparErroCampo(
            elementos.nomeUsuario
          );

          esconderMensagem();
        }
      );

    elementos.senhaAtual
      .addEventListener(
        "input",
        () => {
          limparErroCampo(
            elementos.senhaAtual
          );

          esconderMensagem();
        }
      );

    elementos.novaSenha
      .addEventListener(
        "input",
        () => {
          limparErroCampo(
            elementos.novaSenha
          );

          esconderMensagem();
        }
      );

    elementos.btnTrocarFoto
      ?.addEventListener(
        "click",
        () => {
          if (
            !estado.enviandoFoto
          ) {
            elementos
              .inputFotoUsuario
              ?.click();
          }
        }
      );

    elementos.inputFotoUsuario
      ?.addEventListener(
        "change",
        enviarFotoUsuario
      );

    elementos.formConta
      .addEventListener(
        "submit",
        salvarConta
      );

    elementos.formSenha
      .addEventListener(
        "submit",
        alterarSenha
      );

    elementos.btnLogout
      ?.addEventListener(
        "click",
        sair
      );

    if (
      elementos.inputFotoUsuario
    ) {
      elementos.inputFotoUsuario
        .accept =
          "image/jpeg,image/png,image/webp";
    }

    try {
      estado.contexto =
        await window.SessionGuard
          .exigirConta({
            destinoLogin:
              "/html/login-cliente.html",
          });

      if (
        !estado.contexto
      ) {
        return;
      }

      await carregarMinhaConta();
    } catch (erro) {
      console.error(
        "Erro ao validar sessão:",
        erro
      );

      if (
        tratarErroSessao(
          erro
        )
      ) {
        return;
      }

      mostrarMensagem(
        erro?.message ||
          "Não foi possível validar sua sessão."
      );
    }

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          estado.temporizadorMensagem
        );

        if (
          estado.urlPreview
        ) {
          URL.revokeObjectURL(
            estado.urlPreview
          );
        }
      }
    );
  }
);