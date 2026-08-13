require("dotenv").config({
  quiet: true,
});
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
const registrador = require("./utils/registrador");
const {
  cacheVersionedAsset,
  disableDocumentCache
} = require("./utils/httpCache");
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
const {
  iniciarWorkerCustosMarketing,
  pararWorkerCustosMarketing,
} = require("./services/marketingCostSyncWorker");

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

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "agenda-fashion",
    timestamp: new Date().toISOString(),
  });
});

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
const reactRoutes = require("./config/reactRoutes.json");

app.use(express.static(reactDir, {
  index: false,
  setHeaders(response, filePath) {
    const relativePath = path
      .relative(reactDir, filePath)
      .split(path.sep)
      .join("/");

    if (relativePath === "index.html") {
      disableDocumentCache(response);
      return;
    }

    if (relativePath.startsWith("assets/")) {
      cacheVersionedAsset(response);
    }
  }
}));

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
function obterQueryOriginal(req) {
  const originalUrl =
    String(
      req.originalUrl ||
      ""
    );

  const indiceQuery =
    originalUrl.indexOf("?");

  return indiceQuery >= 0
    ? originalUrl.slice(
        indiceQuery
      )
    : "";
}

function redirecionarPermanente(
  req,
  res,
  destino
) {
  const caminho =
    String(
      destino ||
      "/"
    );

  const destinoInterno =
    caminho.startsWith("/") &&
    !caminho.startsWith("//")
      ? caminho
      : "/";

  return res.redirect(
    301,
    `${destinoInterno}${obterQueryOriginal(req)}`
  );
}

function montarDestinoAppLegado(
  rota
) {
  const segmentos =
    Array.isArray(rota)
      ? rota
      : String(
          rota ||
          ""
        ).split("/");

  const caminho =
    segmentos
      .map(
        (segmento) =>
          String(
            segmento ||
            ""
          ).trim()
      )
      .filter(Boolean)
      .map(
        (segmento) =>
          encodeURIComponent(
            segmento
          )
      )
      .join("/");

  return caminho
    ? `/${caminho}`
    : "/";
}

app.get("/app", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/"
  );
});

app.get("/app/{*rota}", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    montarDestinoAppLegado(
      req.params.rota
    )
  );
});

app.get("/login", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/entrar"
  );
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
    return redirecionarPermanente(
      req,
      res,
      redirecionamentosLegados.get(
        req.path
      )
    );
  }
);


app.get("/inicio.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/"
  );
});

app.get("/login-profissional.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/entrar"
  );
});

app.get("/login-cliente.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/entrar"
  );
});

app.get("/cadastro-profissional.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/cadastro"
  );
});

app.get("/cadastro-cliente.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/cadastro"
  );
});

app.get("/dashboard-profissional.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
    "/profissional/agenda"
  );
});

app.get("/dashboard-dono.html", (req, res) => {
  return redirecionarPermanente(
    req,
    res,
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
const rotasReact = Object.values(
  reactRoutes
);

app.get(
  rotasReact,
  (_req, res, next) => {
    const indexReact =
      path.join(
        reactDir,
        "index.html"
      );

    disableDocumentCache(res);

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
      registrador.informacao(
        `Servidor rodando na porta ${PORT}`
      );

      iniciarWorkerWebhook();
      iniciarWorkerWhatsapp();
      iniciarWorkerCustosMarketing();
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

  registrador.informacao(
    "Encerrando servidor.",
    {
      sinal,
    }
  );

  pararWorkerWebhook();
  pararWorkerWhatsapp();
  pararWorkerCustosMarketing();

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
      registrador.erro(
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
            registrador.erro(
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
