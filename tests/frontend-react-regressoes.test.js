const fs = require("fs");
const path = require("path");

const raiz = path.join(
  __dirname,
  ".."
);

function ler(caminho) {
  return fs.readFileSync(
    path.join(
      raiz,
      caminho
    ),
    "utf8"
  );
}

describe(
  "regressoes do frontend React",
  () => {
    test(
      "remove o frontend legado sem perder compatibilidade de URLs",
      () => {
        [
          "agendamento-nails/html",
          "agendamento-nails/css",
          "agendamento-nails/js",
        ].forEach(
          (caminho) => {
            expect(
              fs.existsSync(
                path.join(
                  raiz,
                  caminho
                )
              )
            ).toBe(false);
          }
        );

        const servidor =
          ler(
            "src/server.js"
          );

        expect(
          servidor
        ).toContain(
          "redirecionamentosLegados"
        );

        expect(
          servidor
        ).not.toContain(
          "express.static(rootDir)"
        );

        expect(
          servidor
        ).not.toMatch(
          /sendFile\(\s*path\.join\(\s*rootDir,\s*"html"/
        );
      }
    );

    test(
      "mantem analytics de produto sem enviar o texto pesquisado",
      () => {
        const explorar =
          ler(
            "frontend/src/pages/ExplorePage.jsx"
          );

        const analytics =
          ler(
            "frontend/src/analytics/track.js"
          );

        expect(
          explorar
        ).toContain(
          'track("tela_visualizada"'
        );

        expect(
          explorar
        ).toContain(
          'mission: "descobrir_servico"'
        );

        expect(
          explorar
        ).toContain(
          'track("categoria_selecionada"'
        );

        expect(
          `${explorar}${analytics}`
        ).not.toContain(
          "termo_digitado"
        );

        expect(
          analytics
        ).toContain(
          "/eventos-produto"
        );

        expect(
          analytics
        ).toContain(
          "keepalive: true"
        );

        expect(
          analytics
        ).toContain(
          ".catch(() =>"
        );
      }
    );

    test(
      "preserva descoberta busca categorias e estados do marketplace",
      () => {
        const explorar =
          ler(
            "frontend/src/pages/ExplorePage.jsx"
          );

        expect(
          explorar
        ).toContain(
          "buildCatalogPath"
        );

        expect(
          explorar
        ).toContain(
          '"Carregar mais"'
        );

        expect(
          explorar
        ).toContain(
          "business.servicos"
        );

        expect(
          explorar
        ).toContain(
          "CATEGORIES"
        );

        expect(
          explorar
        ).toContain(
          "aria-pressed"
        );

        [
          "LoadingState",
          "ErrorState",
          "EmptyState",
          "BusinessCard",
        ].forEach(
          (estado) => {
            expect(
              explorar
            ).toContain(
              estado
            );
          }
        );
      }
    );

    test(
      "carrega paginas por rota e mostra pagina inexistente",
      () => {
        const app = ler("frontend/src/App.jsx");
        const pagina404 = ler(
          "frontend/src/pages/NotFoundPage.jsx"
        );

        expect(app).toContain("lazyNamed");
        expect(app).toContain("<Suspense");
        expect(app).toContain(
          '<Route path="*" element={<NotFoundPage />} />'
        );
        expect(pagina404).toContain(
          "Página não encontrada"
        );
        expect(pagina404).toContain('to="/"');
      }
    );

    test(
      "mantem o dashboard orientado a crescimento e aquisicao",
      () => {
        const dashboard =
          ler(
            "frontend/src/pages/DashboardPage.jsx"
          );

        expect(
          dashboard
        ).toContain(
          '`/dashboard-dono?periodo=${period}`'
        );

        expect(
          dashboard
        ).toContain(
          "Cada agendamento é um passo"
        );

        expect(
          dashboard
        ).toContain(
          "Visitas ao perfil"
        );

        expect(
          dashboard
        ).toContain(
          "Cliques no WhatsApp"
        );

        expect(
          dashboard
        ).toContain(
          "taxa_conversao"
        );

        expect(
          dashboard
        ).toContain(
          'to="/painel/agenda"'
        );

        expect(
          dashboard
        ).toContain(
          'to="/painel/servicos"'
        );
      }
    );

    test(
      "mantem checkout PIX seguro e impede pagamento duplicado",
      () => {
        const cobranca =
          ler(
            "frontend/src/pages/BillingPages.jsx"
          );

        expect(
          cobranca
        ).toContain(
          'inputMode="numeric"'
        );

        expect(
          cobranca
        ).toContain(
          'cpf_cnpj: document.replace(/\\D/g, "")'
        );

        expect(
          cobranca
        ).toContain(
          'forma_pagamento: "pix"'
        );

        expect(
          cobranca
        ).toContain(
          '"Idempotency-Key"'
        );

        expect(
          cobranca
        ).toContain(
          "Você já possui o plano"
        );

        expect(
          cobranca
        ).toContain(
          "attempt < 12"
        );

        expect(
          cobranca
        ).toContain(
          "window.setTimeout(resolve, 2500)"
        );

        expect(
          cobranca
        ).not.toContain(
          "Cartão"
        );
      }
    );

    test(
      "mantem navegacao por papel dentro do React",
      () => {
        const app =
          ler(
            "frontend/src/App.jsx"
          );

        const cabecalho =
          ler(
            "frontend/src/components/AppHeader.jsx"
          );

        const workspace =
          ler(
            "frontend/src/components/WorkspaceLayout.jsx"
          );

        [
          'to="/"',
          'to="/minha-agenda"',
          'to="/cadastro"',
          'to="/entrar"',
        ].forEach(
          (rota) => {
            expect(
              cabecalho
            ).toContain(
              rota
            );
          }
        );

        [
          '["/painel", "Visão geral"',
          '["/painel/agenda", "Agenda"',
          '["/painel/servicos", "Serviços"',
          '["/profissional/agenda", "Minha agenda"',
          '["/profissional/horarios", "Meus horários"',
        ].forEach(
          (rota) => {
            expect(
              workspace
            ).toContain(
              rota
            );
          }
        );

        expect(
          workspace
        ).toContain(
          'negocio?.papel === "dono"'
        );

        expect(
          app
        ).toContain(
          "<ProtectedRoute ownerOnly businessRequired>"
        );
      }
    );

    test(
      "preserva identidade rosa responsividade acessibilidade e mensagem de crescimento",
      () => {
        const css = [
          "frontend/src/styles/index.css",
          "frontend/src/styles/responsive.css",
        ].map(ler).join("\n");

        const explorar =
          ler(
            "frontend/src/pages/ExplorePage.jsx"
          );

        const cabecalho =
          ler(
            "frontend/src/components/AppHeader.jsx"
          );

        const cobranca =
          ler(
            "frontend/src/pages/BillingPages.jsx"
          );

        expect(
          css
        ).toContain(
          "--pink-500: #d92f7f"
        );

        expect(
          css
        ).toContain(
          "@media (max-width: 900px)"
        );

        expect(
          css
        ).toContain(
          "@media (max-width: 620px)"
        );

        expect(
          css
        ).toContain(
          "input:focus"
        );

        expect(
          css
        ).toContain(
          "Camada responsiva final"
        );

        expect(
          css
        ).toContain(
          ".site-header .mobile-agenda-link"
        );

        expect(
          cabecalho
        ).toContain(
          "mobile-agenda-link"
        );

        expect(
          explorar
        ).toContain(
          'aria-label="Categorias"'
        );

        expect(
          cabecalho
        ).toContain(
          'aria-label="Navegação principal"'
        );

        expect(
          cobranca
        ).toContain(
          "O limite é o seu sucesso crescendo"
        );

        expect(
          cobranca
        ).toContain(
          "Planos que acompanham seu sucesso"
        );
      }
    );
  }
);
