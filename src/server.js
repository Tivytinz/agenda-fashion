require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();

const db = require("./db");

const routes = require("./routes/routes");
const negocioRoutes = require("./routes/negocioRoutes");
const servicosRoutes = require("./routes/servicosRoutes");
const profissionaisRoutes = require("./routes/profissionaisRoutes");
const contaRoutes = require("./routes/contaRoutes");
const planosRoutes = require("./routes/planosRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");

app.use("/api", checkoutRoutes);
app.use("/api", planosRoutes);
app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://agenda-fashion-production.up.railway.app",
    "https://agendafashion.com.br",
    "https://www.agendafashion.com.br",
    "https://app.agendafashion.com.br"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const rootDir = path.join(process.cwd(), "agendamento-nails");

app.use(express.static(rootDir));
app.use("/public", express.static(path.join(rootDir, "public")));

/* =========================
   ROTAS PRINCIPAIS
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "login-profissional.html"));
});

app.get("/cadastro", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "cadastro-profissional.html"));
});

app.get("/demo", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "inicio.html"));
});

/* =========================
   COMPATIBILIDADE COM LINKS ANTIGOS
========================= */

app.get("/inicio.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "inicio.html"));
});

app.get("/login-profissional.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "login-profissional.html"));
});

app.get("/login-cliente.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "login-cliente.html"));
});

app.get("/cadastro-profissional.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "cadastro-profissional.html"));
});

app.get("/cadastro-cliente.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "cadastro-cliente.html"));
});

app.get("/dashboard-profissional.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "dashboard-profissional.html"));
});

app.get("/dashboard-dono.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "dashboard-dono.html"));
});

app.get("/painel-profissional.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "painel-profissional.html"));
});

app.get("/painel-dono.html", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "painel-dono.html"));
});

/* =========================
   APIs
========================= */

app.use("/conta", contaRoutes);
app.use("/api/negocios", negocioRoutes);
app.use("/servicos", servicosRoutes);
app.use("/profissionais", profissionaisRoutes);
app.use(routes);

/* =========================
   START
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  db.query("SELECT NOW()")
    .then((resultado) => {
      console.log("Banco conectado:", resultado.rows);
    })
    .catch((err) => {
      console.error("Erro banco:", err);
    });
});

