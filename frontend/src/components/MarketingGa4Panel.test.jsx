// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingGa4Panel } from "./MarketingGa4Panel";

afterEach(() => cleanup());

describe("MarketingGa4Panel", () => {
  it("explica quando a leitura da Data API não está disponível", () => {
    render(
      <MarketingGa4Panel
        data={{ habilitado: false, configurado: false }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "O que acontece depois do clique" })
    ).not.toBeNull();
    expect(screen.getByText(/leitura do GA4 ainda não está disponível/i)).not.toBeNull();
    expect(screen.getByText(/coleta e a leitura administrativa são configurações diferentes/i)).not.toBeNull();
  });

  it("mostra comportamento priorizado sem chamar GA4 de fonte financeira", () => {
    render(
      <MarketingGa4Panel
        data={{
          habilitado: true,
          configurado: true,
          fonte: "Google Analytics 4 · Data API",
          resumo: {
            sessoes: 100,
            usuarios: 80,
            novosUsuarios: 40,
            sessoesEngajadas: 60,
            taxaEngajamentoPercentual: 60,
            visualizacoes: 250
          },
          canais: [
            {
              canal: "Paid Search",
              origem: "google",
              midia: "cpc",
              sessoes: 55,
              usuarios: 44
            }
          ],
          campanhas: [
            {
              id: "987",
              nome: "Profissionais",
              origem: "google",
              midia: "cpc",
              sessoes: 50,
              usuarios: 40,
              sessoesEngajadas: 32
            }
          ],
          landingPages: [
            {
              pagina: "/para-profissionais",
              sessoes: 70,
              usuarios: 58
            }
          ],
          dispositivos: [
            {
              categoria: "mobile",
              sessoes: 75,
              usuarios: 60
            }
          ],
          localidades: [
            {
              pais: "Brazil",
              regiao: "Goiás",
              cidade: "Goiânia",
              sessoes: 42,
              usuarios: 35
            }
          ]
        }}
      />
    );

    expect(screen.getByText("GA4 conectado")).not.toBeNull();
    expect(screen.getByText("100")).not.toBeNull();
    expect(screen.getByText("Paid Search")).not.toBeNull();
    expect(screen.getByText("Profissionais")).not.toBeNull();
    expect(screen.getByText("/para-profissionais")).not.toBeNull();
    expect(screen.getByText("Celular")).not.toBeNull();
    expect(screen.getByText("Goiânia")).not.toBeNull();
    expect(screen.getByText("De onde chegam")).not.toBeNull();
    expect(screen.getByText("Onde entram")).not.toBeNull();
    expect(screen.getByText(/ativação, agendamento, assinatura/i)).not.toBeNull();
  });

  it("mantém aviso quando o relatório é amostrado", () => {
    render(
      <MarketingGa4Panel
        data={{
          habilitado: true,
          configurado: true,
          amostrado: true,
          resumo: {}
        }}
      />
    );

    expect(screen.getByText(/o GA4 aplicou limites ao relatório/i)).not.toBeNull();
  });
});
