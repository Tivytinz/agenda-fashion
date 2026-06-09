require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
console.log("DATABASE_URL existe?", !!process.env.DATABASE_URL);

const db = require("./db");

const routes = require("./routes/routes");
const negocioRoutes = require("./routes/negocioRoutes");
const servicosRoutes = require("./routes/servicosRoutes");
const profissionaisRoutes = require("./routes/profissionaisRoutes");
const contaRoutes = require("./routes/contaRoutes");

app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://agenda-fashion-production.up.railway.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const rootDir = process.cwd();

app.use(express.static(rootDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "html", "inicio.html"));
});

app.use("/conta", contaRoutes);
app.use("/api/negocios", negocioRoutes);
app.use("/servicos", servicosRoutes);
app.use("/profissionais", profissionaisRoutes);
app.use(routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  db.query("SELECT NOW()")
    .then((res) => {
      console.log("Banco conectado:", res.rows);
    })
    .catch((err) => {
      console.error("Erro banco:", err);
    });
});