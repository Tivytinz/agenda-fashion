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

    crossOriginOpenerPolicy: {
      policy:
        "same-origin-allow-popups",
    },

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

app.use(express.static(reactDir));

app.use(agendaConfiguracaoRoutes);

/* =========================
   ROTAS PRINCIPAIS
========================= */



/*
 * O React é migrado por fluxo e convive com o frontend atual.
 * O fallback abaixo permite que o React Router resolva /app/*.
 */
/*
 * Compatibilidade temporaria:
 * /app/painel -> /painel
 * /login -> /entrar
 */
app.get("/app", (_req, res) => {
  return res.redirect(301, "/");
});

app.get("/app/{*rota}", (req, res) => {
  return res.redirect(
    301,
    `/${req.params.rota}`
  );
});

app.get("/login", (_req, res) => {
  return res.redirect(301, "/entrar");
});
/* =========================
   COMPATIBILIDADE COM LINKS ANTIGOS
========================= */
const redirecionamentosLegados = new Map([
  ["/admin.html", "/painel"],
  ["/agenda-geral.html", "/painel/agenda"],
  ["/agenda-profissional.html", "/profissional/agenda"],
  ["/checkout.html", "/checkout"],
  ["/criar-negocio.html", "/criar-negocio"],
  ["/meus-agendamentos.html", "/minha-agenda"],
  ["/minha-assinatura.html", "/painel/assinatura"],
  ["/perfil-negocio.html", "/"],
  ["/planos.html", "/planos"],
  ["/configuracao-agenda.html", "/painel/horarios"],
  ["/escolher-negocio.html", "/"],
  ["/favoritos.html", "/favoritos"],
  ["/finalizar-agendamento.html", "/confirmar"],
  ["/minha-conta.html", "/conta"],
]);

app.get(
  Array.from(
    redirecionamentosLegados.keys()
  ),
  (req, res) => {
    return res.redirect(
      301,
      redirecionamentosLegados.get(
        req.path
      )
    );
  }
);


app.get("/inicio.html", (_req, res) => {
  return res.redirect(
    301,
    "/"
  );
});

app.get("/login-profissional.html", (_req, res) => {
  return res.redirect(
    301,
    "/entrar"
  );
});

app.get("/login-cliente.html", (_req, res) => {
  return res.redirect(
    301,
    "/entrar"
  );
});

app.get("/cadastro-profissional.html", (_req, res) => {
  return res.redirect(
    301,
    "/cadastro"
  );
});

app.get("/cadastro-cliente.html", (_req, res) => {
  return res.redirect(
    301,
    "/cadastro"
  );
});

app.get("/dashboard-profissional.html", (_req, res) => {
  return res.redirect(
    301,
    "/profissional/agenda"
  );
});

app.get("/dashboard-dono.html", (_req, res) => {
  return res.redirect(
    301,
    "/painel"
  );
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

/*
 * Rotas da SPA React.
 *
 * Elas ficam depois das APIs para que endpoints reais tenham prioridade.
 * A lista explicita evita devolver index.html para uma API inexistente.
 */
const rotasReact = [
  "/",
  "/entrar",
  "/cadastro",
  "/confirmar",
  "/sucesso",
  "/minha-agenda",
  "/favoritos",
  "/criar-negocio",
  "/conta",
  "/planos",
  "/checkout",
  "/painel",
  "/painel/agenda",
  "/painel/servicos",
  "/painel/servicos/novo",
  "/painel/servicos/:id/editar",
  "/painel/profissionais",
  "/painel/horarios",
  "/painel/negocio",
  "/painel/assinatura",
  "/profissional/agenda",
  "/profissional/horarios",
  "/negocio/:slug",
];

app.get(
  rotasReact,
  (_req, res, next) => {
    const indexReact =
      path.join(
        reactDir,
        "index.html"
      );

    res.sendFile(
      indexReact,
      (erro) => {
        if (erro) {
          next(erro);
        }
      }
    );
  }
);
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
