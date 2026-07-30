require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const {
  corsOptions,
} = require("./config/cors");

const db = require("./db/db");
const apiRoutes = require("./routes/index");
const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const requestLogger = require("./middlewares/requestLogger");
const agendaConfiguracaoRoutes = require("./routes/agendaConfiguracaoRoutes");
const {
  iniciarWorkerWebhook,
  pararWorkerWebhook,
} = require("./services/webhookService");
const {
  validarConfigAsaas
} = require("./services/asaasService");
const {
  iniciarWorkerWhatsapp,
  pararWorkerWhatsapp,
} = require("./services/whatsappMensagemService");

const app = express();

app.set(
  "trust proxy",
  1
);

app.disable(
  "x-powered-by"
);

app.use(
  helmet({
    contentSecurityPolicy:
      false,
    crossOriginResourcePolicy: {
      policy:
        "cross-origin",
    },
  })
);

app.use(
  (req, res, next) => {
    const recebido =
      String(
        req.headers[
          "x-request-id"
        ] || ""
      ).trim();

    req.id =
      /^[a-zA-Z0-9._:-]{8,100}$/
        .test(recebido)
        ? recebido
        : crypto.randomUUID();

    res.setHeader(
      "X-Request-ID",
      req.id
    );

    next();
  }
);

app.use(
  requestLogger
);

app.use(
  express.json({
    limit:
      "1mb",
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

app.use(
  cors(
    corsOptions
  )
);

app.get(
  "/health/live",
  (_req, res) => {
    res.status(200).json({
      status:
        "ok",
    });
  }
);

app.get(
  "/health/ready",
  async (_req, res) => {
    try {
      await db.query(
        "SELECT 1"
      );

      return res
        .status(200)
        .json({
          status:
            "ready",
          database:
            "ok",
        });
    } catch {
      return res
        .status(503)
        .json({
          status:
            "unavailable",
          database:
            "error",
        });
    }
  }
);

const rootDir = path.join(process.cwd(), "agendamento-nails");
const reactDir = path.join(rootDir, "react-app");

app.use(express.static(rootDir));
app.use("/public", express.static(path.join(rootDir, "public")));
app.use("/app", express.static(reactDir));

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

/*
 * O React é migrado por fluxo e convive com o frontend atual.
 * O fallback abaixo permite que o React Router resolva /app/*.
 */
app.get(["/app", "/app/{*rota}"], (req, res, next) => {
  const indexReact = path.join(reactDir, "index.html");

  res.sendFile(indexReact, (erro) => {
    if (erro) {
      next(erro);
    }
  });
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

if (
  process.env.NODE_ENV !==
  "production"
) {
  const swaggerUi =
    require(
      "swagger-ui-express"
    );

  const swaggerSpec =
    require("./docs/swagger");

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(
      swaggerSpec
    )
  );
}

app.use(
  notFound
);

app.use(errorHandler);

/* =========================
   START
========================= */

const PORT = process.env.PORT || 3000;

let servidor =
  null;
let encerrando =
  false;

async function iniciarServidor() {
  if (
    process.env.NODE_ENV ===
      "production" ||
    process.env.ASAAS_API_URL ||
    process.env.ASAAS_API_KEY
  ) {
    validarConfigAsaas();
  }

  await db.query(
    "SELECT 1"
  );

  servidor =
    app.listen(PORT, () => {
      console.log(
        `Servidor rodando na porta ${PORT}`
      );

      iniciarWorkerWebhook();
      iniciarWorkerWhatsapp();
    });

  return servidor;
}

async function encerrarServidor(
  sinal
) {
  if (encerrando) {
    return;
  }

  encerrando =
    true;

  console.info(
    "Encerrando servidor.",
    {
      sinal,
    }
  );

  pararWorkerWebhook();
  pararWorkerWhatsapp();

  if (servidor) {
    await new Promise(
      (resolve) => {
        servidor.close(
          resolve
        );
      }
    );
  }

  await db.end();
}

if (
  process.env.NODE_ENV !==
  "test"
) {
  iniciarServidor()
    .catch((erro) => {
      console.error(
        "Falha ao iniciar o servidor:",
        erro
      );

      process.exitCode = 1;
    });

  for (
    const sinal
    of [
      "SIGTERM",
      "SIGINT",
    ]
  ) {
    process.once(
      sinal,
      () => {
        encerrarServidor(
          sinal
        )
          .then(() => {
            process.exitCode =
              0;
          })
          .catch((erro) => {
            console.error(
              "Falha durante o encerramento:",
              erro
            );

            process.exitCode =
              1;
          });
      }
    );
  }
}

module.exports = app;
module.exports.iniciarServidor =
  iniciarServidor;
module.exports.encerrarServidor =
  encerrarServidor;
