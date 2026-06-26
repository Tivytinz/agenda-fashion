window.API = {
  async request(path, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
      ...(options.headers || {})
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.erro || data.mensagem || "Erro na requisição.");
    }

    return data;
  },

  get(path) {
    return this.request(path, {
      method: "GET"
    });
  },

  post(path, body) {
    return this.request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  put(path, body) {
    return this.request(path, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  patch(path, body) {
    return this.request(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  delete(path) {
    return this.request(path, {
      method: "DELETE"
    });
  }
};