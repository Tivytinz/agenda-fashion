require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");


const path = require("path");
const express = require("express");
const cors = require("cors");

const db = require("./db/db");
const apiRoutes = require("./routes/index");
const errorHandler = require("./middlewares/errorHandler");
const agendaConfiguracaoRoutes = require("./routes/agendaConfiguracaoRoutes");
const {
  iniciarWorkerWebhook
} = require("./services/webhookService");
const {
  validarConfigAsaas
} = require("./services/asaasService");
const {
  iniciarWorkerWhatsapp
} = require("./services/whatsappMensagemService");

const app = express();

app.use(
  express.json({
    verify: (
      req,
      _res,
      buffer
    ) => {
      if (
        req.originalUrl
          ?.startsWith(
            "/webhook/whatsapp"
          )
      ) {
        req.rawBody =
          Buffer.from(buffer);
      }
    },
  })
);

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
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Idempotency-Key"
  ]
}));

const rootDir = path.join(process.cwd(), "agendamento-nails");

app.use(express.static(rootDir));
app.use("/public", express.static(path.join(rootDir, "public")));

app.use(agendaConfiguracaoRoutes);

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






/* =========================
   APIs
========================= */

app.use(apiRoutes);

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

app.use(errorHandler);

/* =========================
   START
========================= */

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "test") {
  if (
    process.env.NODE_ENV ===
      "production" ||
    process.env.ASAAS_API_URL ||
    process.env.ASAAS_API_KEY
  ) {
    validarConfigAsaas();
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);

    iniciarWorkerWebhook();
    iniciarWorkerWhatsapp();

    db.query("SELECT NOW()")
      .then((resultado) => {
        console.log("Banco conectado:", resultado.rows);
      })
      .catch((err) => {
        console.error("Erro banco:", err);
      });
  });
}

module.exports = app;
