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

app.use(express.static(path.join(__dirname, "../")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../html/inicio.html"));
});

app.use("/conta", contaRoutes);
app.use("/api/negocios", negocioRoutes);
app.use("/servicos", servicosRoutes);
app.use("/profissionais", profissionaisRoutes);
app.use(routes);

db.query("SELECT NOW()")
  .then((res) => {
    console.log("Banco conectado:", res.rows);
  })
  .catch((err) => {
    console.error("Erro:", err);
  });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});