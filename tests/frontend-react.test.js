const fs = require("fs");
const path = require("path");

const raiz = path.join(
  __dirname,
  ".."
);

function ler(caminho) {
  return fs.readFileSync(
    path.join(raiz, caminho),
    "utf8"
  );
}

const rotasReact = JSON.parse(
  ler("src/config/reactRoutes.json")
);

describe(
  "Frontend React",
  () => {
    test(
      "mantém o React isolado do frontend legado",
      () => {
        const pacote =
          JSON.parse(
            ler(
              "frontend/package.json"
            )
          );

        expect(
          pacote.dependencies.react
        ).toBeTruthy();

        expect(
          pacote.dependencies[
            "react-router-dom"
          ]
        ).toBeTruthy();

        expect(
          pacote.scripts.build
        ).toBe(
          "vite build"
        );
      }
    );

    test(
      "preserva os endpoints sem prefixo api",
      () => {
        const perfil =
          ler(
            "frontend/src/pages/ProfilePage.jsx"
          );

        const confirmacao =
          ler(
            "frontend/src/pages/ConfirmPage.jsx"
          );
        const agenda =
          ler(
            "frontend/src/pages/MyAppointmentsPage.jsx"
          );

        expect(
          perfil
        ).toContain(
          "`/agenda-publica?"
        );

        expect(
          perfil
        ).toContain(
          "`/perfil-negocio/"
        );

        expect(
          confirmacao
        ).toContain(
          'apiRequest("/agendamentos"'
        );

        expect(
          agenda
        ).toContain(
          'apiRequest("/meus-agendamentos"'
        );

        expect(
          agenda
        ).toContain(
          "`/agendamentos/${appointment.id}/cancelar`"
        );

        expect(
          `${perfil}${confirmacao}${agenda}`
        ).not.toContain(
          '"/api/'
        );
      }
    );

    test(
      "serve o aplicativo React na raiz do dominio",
      () => {
        const servidor =
          ler(
            "src/server.js"
          );

        const main =
          ler(
            "frontend/src/main.jsx"
          );

        const vite =
          ler(
            "frontend/vite.config.js"
          );

        const cache =
          ler(
            "src/utils/httpCache.js"
          );

        expect(
          servidor
        ).toContain(
          "app.use(express.static(reactDir, {"
        );

        expect(cache).toContain(
          '"no-store, no-cache, must-revalidate"'
        );

        expect(cache).toContain(
          '"public, max-age=31536000, immutable"'
        );

        expect(
          servidor
        ).toContain(
          "const rotasReact ="
        );

        expect(
          ler(
            "src/config/reactRoutes.json"
          )
        ).toContain(
          '"dashboard": "/painel"'
        );

        expect(
          servidor
        ).not.toContain(
          'app.use("/app", express.static(reactDir))'
        );

        expect(
          main
        ).not.toContain(
          'basename="/app"'
        );

        expect(
          vite
        ).toContain(
          'base: "/"'
        );
      }
    );

    test(
      "trata estados reais da jornada de agendamento",
      () => {
        const card =
          ler(
            "frontend/src/components/BusinessCard.jsx"
          );

        const perfil =
          ler(
            "frontend/src/pages/ProfilePage.jsx"
          );

        const confirmacao =
          ler(
            "frontend/src/pages/ConfirmPage.jsx"
          );

        expect(
          card
        ).toContain(
          "Agenda em configuração"
        );

        expect(
          card
        ).toContain(
          "formatRating"
        );

        expect(
          perfil
        ).toContain(
          "normalizeAvailability"
        );

        expect(
          perfil
        ).toContain(
          "agenda_indisponivel"
        );

        expect(
          confirmacao
        ).toContain(
          "Escolher outro horário"
        );
      }
    );

    test(
      "mantém a agenda e o sucesso dentro do React",
      () => {
        const app =
          ler(
            "frontend/src/App.jsx"
          );

        const sucesso =
          ler(
            "frontend/src/pages/SuccessPage.jsx"
          );

        const agenda =
          ler(
            "frontend/src/pages/MyAppointmentsPage.jsx"
          );

        expect(
          app
        ).toContain(
          "path={reactRoutes.myAgenda}"
        );
        expect(rotasReact.myAgenda).toBe("/minha-agenda");

        expect(
          sucesso
        ).toContain(
          'to="/minha-agenda"'
        );

        expect(
          sucesso
        ).not.toContain(
          "meus-agendamentos.html"
        );

        expect(
          agenda
        ).toContain(
          "readRecentAppointment"
        );

        expect(
          agenda
        ).toContain(
          "Agendamento como visitante"
        );

        expect(
          agenda
        ).toContain(
          "CancelDialog"
        );

        expect(
          agenda
        ).not.toContain(
          "window.confirm"
        );
      }
    );

    test(
      "mantém autenticação e onboarding dentro do React",
      () => {
        const app = ler(
          "frontend/src/App.jsx"
        );
        const autenticacao = ler(
          "frontend/src/pages/AuthPage.jsx"
        );
        const negocio = ler(
          "frontend/src/pages/BusinessPage.jsx"
        );

        expect(app).toContain(
          "path={reactRoutes.login}"
        );
        expect(app).toContain(
          "path={reactRoutes.register}"
        );
        expect(app).toContain(
          "path={reactRoutes.createBusiness}"
        );
        expect(rotasReact).toMatchObject({
          login: "/entrar",
          register: "/cadastro",
          createBusiness: "/criar-negocio",
        });
        expect(autenticacao).toContain(
          'session.loginWithGoogle'
        );
        expect(negocio).toContain(
          '"/criar-negocio"'
        );
        expect(
          `${app}${autenticacao}${negocio}`
        ).not.toContain(
          ".html"
        );
      }
    );

    test(
      "migra os fluxos operacionais da dona e profissional",
      () => {
        const app = ler(
          "frontend/src/App.jsx"
        );
        const agenda = ler(
          "frontend/src/pages/AgendaWorkspacePage.jsx"
        );
        const servicos = ler(
          "frontend/src/pages/ServicesPage.jsx"
        );
        const horarios = ler(
          "frontend/src/pages/ScheduleSettingsPage.jsx"
        );
        const profissionais = ler(
          "frontend/src/pages/ProfessionalsPage.jsx"
        );

        [
          ["dashboard", "/painel"],
          ["ownerAgenda", "/painel/agenda"],
          ["services", "/painel/servicos"],
          ["professionals", "/painel/profissionais"],
          ["schedule", "/painel/horarios"],
          ["professionalAgenda", "/profissional/agenda"],
        ].forEach(
          ([chave, rota]) => {
            expect(app).toContain(
              `path={reactRoutes.${chave}}`
            );
            expect(rotasReact[chave]).toBe(rota);
          }
        );

        expect(agenda).toContain(
          '"/bloqueios-horario"'
        );
        expect(servicos).toContain(
          'apiRequest("/servicos"'
        );
        expect(horarios).toContain(
          '"/agenda-configuracao"'
        );
        expect(profissionais).toContain(
          '"/profissionais/vincular"'
        );
        expect(profissionais).toContain(
          'apiRequest("/profissionais")'
        );
        expect(profissionais).not.toContain(
          "perfil-negocio"
        );
        expect(servicos).not.toContain(
          "window.confirm"
        );
      }
    );

    test(
      "migra conta favoritos planos assinatura e checkout",
      () => {
        const app = ler(
          "frontend/src/App.jsx"
        );
        const conta = ler(
          "frontend/src/pages/AccountPage.jsx"
        );
        const favoritos = ler(
          "frontend/src/pages/FavoritesPage.jsx"
        );
        const cobranca = ler(
          "frontend/src/pages/BillingPages.jsx"
        );
        const assinatura = ler(
          "frontend/src/pages/SubscriptionPage.jsx"
        );
        const planos = ler(
          "frontend/src/utils/plans.js"
        );

        expect(app).toContain(
          "path={reactRoutes.account}"
        );
        expect(app).toContain(
          "path={reactRoutes.favorites}"
        );
        expect(app).toContain(
          "path={reactRoutes.plans}"
        );
        expect(app).toContain(
          "path={reactRoutes.checkout}"
        );
        expect(rotasReact).toMatchObject({
          account: "/conta",
          favorites: "/favoritos",
          plans: "/planos",
          checkout: "/checkout",
        });
        expect(conta).toContain(
          '"/conta/foto"'
        );
        expect(favoritos).toContain(
          'apiRequest("/favoritos"'
        );
        expect(cobranca).toContain(
          '"Idempotency-Key"'
        );
        expect(assinatura).toContain(
          '"/minha-assinatura"'
        );
        expect(cobranca).toContain(
          '`/checkout/status/'
        );
        expect(planos).toContain(
          '"WhatsApp Business incluído"'
        );
        expect(cobranca).toContain(
          "Você já possui o plano"
        );
        expect(cobranca).toContain(
          'forma_pagamento: "pix"'
        );
        expect(cobranca).not.toContain(
          "Cartão"
        );
        expect(app).toContain(
          "<WorkspaceLayout>"
        );
      }
    );
  }
);
