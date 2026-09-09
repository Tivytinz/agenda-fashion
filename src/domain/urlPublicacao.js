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

module.exports = { urlPublicacaoValida };
