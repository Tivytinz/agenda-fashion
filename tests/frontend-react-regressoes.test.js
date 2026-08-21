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
          "CATEGORY_SPOTLIGHTS"
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
          'const normalizedDocument = document.replace(/\\D/g, "")'
        );

        expect(
          cobranca
        ).toContain(
          "cpf_cnpj: normalizedDocument"
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
          "checkoutAttemptRef.current.key"
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
          'to="/favoritos"',
          'to="/minha-agenda"',
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

        expect(cabecalho).toContain(
          '"/para-profissionais"'
        );

        [
          '["/painel", "Visão geral"',
          '["/painel/agenda", "Agenda"',
          '["/painel/servicos", "Serviços"',
          '["/painel/profissionais", "Equipe"',
          '["/profissional/agenda", "Minha agenda"',
          '["/profissional/horarios", "Meus horários"',
          '["/admin/trafego-pago", "Campanhas"',
          '["/admin/trafego-pago/custos", "Custos"',
          '["/admin/trafego-pago/profissionais", "Rentabilidade"',
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
          workspace
        ).toContain(
          "export function AdminLayout"
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
          "Sistema responsivo único do Agenda Fashion"
        );

        expect(
          css
        ).toContain(
          ".site-header .mobile-home-link"
        );

        expect(
          cabecalho
        ).toContain(
          "mobile-home-link"
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

    test(
      "unifica o visual do AF sem retornar ao vinho",
      () => {
        const principal = ler(
          "frontend/src/main.jsx"
        );
        const base = ler(
          "frontend/src/styles/index.css"
        );
        const experiencia = ler(
          "frontend/src/styles/af-experience.css"
        );

        expect(principal).toContain(
          'import "./styles/af-experience.css"'
        );
        expect(base).toContain(
          "--wine: #382f34"
        );
        expect(experiencia).toContain(
          ".public-profile-page"
        );
        expect(experiencia).toContain(
          ".workspace-heading"
        );
        expect(experiencia).toContain(
          ".admin-marketing-page"
        );
        expect(experiencia).toContain(
          ".professional-hero-grid"
        );
        expect(`${base}${experiencia}`).not.toContain(
          "#69243f"
        );
      }
    );

    test(
      "evita que cabeçalhos administrativos cubram as linhas",
      () => {
        const admin = ler(
          "frontend/src/styles/admin-marketing.css"
        );

        expect(admin).not.toMatch(
          /\.admin-workspace-page \.table-wrap thead th\s*\{[^}]*position:\s*sticky/s
        );
      }
    );

    test(
      "mantem retornos compactos e acoes do WhatsApp agrupadas",
      () => {
        const experiencia = ler(
          "frontend/src/styles/af-experience.css"
        );
        const whatsapp = ler(
          "frontend/src/styles/admin-whatsapp.css"
        );

        expect(experiencia).toMatch(
          /\.back-link\s*\{[^}]*width:\s*fit-content/s
        );
        expect(whatsapp).toMatch(
          /\.whatsapp-heading-actions\s*\{[^}]*display:\s*flex/s
        );
        expect(whatsapp).toMatch(
          /\.whatsapp-heading-actions\s*\{[^}]*justify-content:\s*flex-end/s
        );
      }
    );

    test(
      "mantem a home fiel ao prototipo aprovado",
      () => {
        const principal = ler(
          "frontend/src/main.jsx"
        );
        const cabecalho = ler(
          "frontend/src/components/AppHeader.jsx"
        );
        const inicio = ler(
          "frontend/src/pages/ExplorePage.jsx"
        );
        const visual = ler(
          "frontend/src/styles/home-discovery.css"
        );

        expect(cabecalho).not.toContain(
          "Buscar serviços"
        );
        expect(cabecalho).toContain(
          "Favoritos"
        );
        expect(cabecalho).toContain(
          "Meus agendamentos"
        );
        expect(cabecalho).toContain(
          "header-search"
        );
        expect(cabecalho).toContain(
          "header-account-avatar"
        );
        expect(inicio).toContain(
          "HERO_SLIDES"
        );
        expect(inicio).toContain(
          "home-hero-dots"
        );
        expect(inicio).toContain(
          "CATEGORY_CARD_IMAGES"
        );
        expect(inicio).not.toContain(
          "Ver todos"
        );
        expect(inicio).not.toContain(
          "Deslize →"
        );
        expect(inicio).toContain(
          "maquiagemHero"
        );
        expect(inicio).not.toContain(
          "serviceCategoryEmoji"
        );
        expect(inicio).not.toContain(
          "home-search-panel"
        );
        expect(visual).toContain(
          ".home-hero-track"
        );
        expect(visual).toContain(
          ".home-location-pill"
        );
        expect(
          principal.indexOf(
            'import "./styles/home-discovery.css"'
          )
        ).toBeGreaterThan(
          principal.indexOf(
            'import "./styles/af-experience.css"'
          )
        );
      }
    );

    test(
      "mantem uma unica fonte para os breakpoints do frontend",
      () => {
        const principal = ler(
          "frontend/src/styles/index.css"
        );
        const responsivo = ler(
          "frontend/src/styles/responsive.css"
        );
        const entrada = ler(
          "frontend/src/main.jsx"
        );

        expect(
          principal
        ).not.toMatch(
          /@media\s*\(/
        );

        [
          "@media (max-width: 900px)",
          "@media (max-width: 800px)",
          "@media (max-width: 620px)",
          "@media (max-width: 390px)",
          "@media (prefers-reduced-motion: reduce)",
        ].forEach(
          (breakpoint) => {
            expect(
              responsivo
            ).toContain(
              breakpoint
            );
          }
        );

        expect(
          entrada.indexOf(
            '"./styles/index.css"'
          )
        ).toBeLessThan(
          entrada.indexOf(
            '"./styles/responsive.css"'
          )
        );

        expect(
          responsivo.match(/@media\s*\(/g)
        ).toHaveLength(7);

        expect(
          responsivo
        ).not.toMatch(
          /(?:POLISH|POLIMENTO|UX FINAL|V3|Proteções finais)/i
        );

        expect(
          principal
        ).not.toMatch(
          /MOBILE (?:SYSTEM|VISUAL|FINAL|UX|POLISH|POLIMENTO)/i
        );
      }
    );
  }
);
