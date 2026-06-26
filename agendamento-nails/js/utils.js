window.Utils = {

  mostrarMensagem(elemento, texto, cor = "#e63946") {
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.color = cor;
    elemento.classList.remove("hidden");
  },

  esconderMensagem(elemento) {
    if (!elemento) return;

    elemento.textContent = "";
    elemento.classList.add("hidden");
  },

  formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  },

  avatarIniciais(nome = "") {
    return nome
      .split(" ")
      .map(p => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

};