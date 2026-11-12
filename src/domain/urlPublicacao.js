function urlPublicacaoValida(valor) {
  const texto = String(valor ?? "").trim();
  if (!/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(texto)) return false;

  try {
    const url = new URL(texto);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}


// Para novas gravações, aceitar apenas destino reconhecido de mapas.
// Links legados já salvos são avaliados pelo contrato antigo até migração
// explícita; não despublicar negócios existentes silenciosamente.
function urlMapaReconhecido(valor) {
  try {
    const url = valor instanceof URL ? valor : new URL(String(valor));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ["maps.google.com", "maps.google.com.br", "maps.app.goo.gl", "maps.apple.com"]
      .includes(host) || (
        ["google.com", "www.google.com", "google.com.br", "www.google.com.br"]
          .includes(host) && /^\/maps(?:\/|$)/.test(url.pathname)
      );
  } catch { return false; }
}

module.exports = { urlPublicacaoValida, urlMapaReconhecido };
