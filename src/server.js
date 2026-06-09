require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const db = require("./db");

const routes = require("./routes/routes");
const negocioRoutes = require("./routes/negocioRoutes");
const servicosRoutes = require("./routes/servicosRoutes");
const profissionaisRoutes = require("./routes/profissionaisRoutes");
const contaRoutes = require("./routes/contaRoutes");

/* =========================
   CORS
========================= */

app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* =========================
   ROTAS
========================= */

app.use("/conta", contaRoutes);

app.use("/api/negocios", negocioRoutes);

app.use("/servicos", servicosRoutes);

app.use("/profissionais", profissionaisRoutes);

app.use(routes);

/* =========================
   TESTE BANCO
========================= */

db.query("SELECT NOW()")
  .then((res) => {
    console.log("Banco conectado:", res.rows);
  })
  .catch((err) => {
    console.error("Erro:", err);
  });

/* =========================
   START
========================= */

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});