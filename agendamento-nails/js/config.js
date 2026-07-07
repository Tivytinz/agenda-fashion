window.AF_CONFIG = {
  API_URL:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : "https://app.agendafashion.com.br",
};

window.API_URL = window.AF_CONFIG.API_URL;