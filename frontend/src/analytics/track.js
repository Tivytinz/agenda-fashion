const SESSION_KEY = "af_produto_sessao";

function sessionId() {
  const current = sessionStorage.getItem(SESSION_KEY);

  if (current) {
    return current;
  }

  const created = crypto.randomUUID().replaceAll("-", "").slice(0, 32);
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export function track(name, {
  page,
  mission,
  businessId,
  properties = {}
}) {
  const payload = {
    nome: name,
    pagina: page,
    missao: mission,
    sessao_id: sessionId(),
    negocio_id: businessId || undefined,
    propriedades: properties
  };

  const token = localStorage.getItem("token");

  void fetch(`${String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")}/eventos-produto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {
    // Métricas nunca bloqueiam o agendamento.
  });
}
