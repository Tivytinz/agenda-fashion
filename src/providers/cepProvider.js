const AppError = require("../errors/AppError");

const VIA_CEP_BASE_URL = "https://viacep.com.br/ws";
const DEFAULT_TIMEOUT_MS = 4000;

async function consultarCepViaCep(
  cep,
  {
    fetchImpl = global.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw new AppError(
      "Serviço de consulta de CEP indisponível.",
      503
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetchImpl(
      `${VIA_CEP_BASE_URL}/${encodeURIComponent(cep)}/json/`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new AppError(
        "Serviço de consulta de CEP indisponível.",
        503
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Serviço de consulta de CEP indisponível.",
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  consultarCepViaCep,
};
