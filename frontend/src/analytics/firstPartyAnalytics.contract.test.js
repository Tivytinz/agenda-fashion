// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  startFirstPartyPageView,
  trackFirstPartyEvent,
  firstPartyAnalyticsInternals
} from "./firstPartyAnalytics";
import cases from "../../../tests/fixtures/professional-signup-analytics.json";

const { flushOutbox } = firstPartyAnalyticsInternals;

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

function capturedEvents() {
  return fetch.mock.calls.flatMap(([url, options]) =>
    String(url).endsWith("/analytics/collect")
      ? JSON.parse(options.body).items.filter(item => item.type === "event")
      : []
  );
}

it("navegador emite exatamente os casos do contrato aceitos pelo backend, sem dados pessoais", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 202 })));
  startFirstPartyPageView({ pathname: "/cadastro", search: "?tipo=profissional" });
  for (const { name, properties } of cases) {
    trackFirstPartyEvent(name, { properties });
  }
  await flushOutbox();
  expect(capturedEvents().map(({ name, properties }) => ({ name, properties })))
    .toEqual(cases);
  expect(JSON.stringify(capturedEvents())).not.toContain("@teste.local");
});

it("não emite signup profissional na rota de cliente e descarta método inválido", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 202 })));
  startFirstPartyPageView({ pathname: "/cadastro", search: "?tipo=profissional" });
  await flushOutbox();
  trackFirstPartyEvent("professional_signup_submitted", {
    properties: { method: "user@teste.local" }
  });
  await flushOutbox();
  expect(capturedEvents()).toHaveLength(0);
  startFirstPartyPageView({ pathname: "/cadastro", search: "?tipo=cliente" });
  await flushOutbox();
  trackFirstPartyEvent("professional_signup_started", {
    properties: { method: "email", trigger: "form_input" }
  });
  await flushOutbox();
  expect(capturedEvents().filter(x => x.name === "professional_signup_started")).toHaveLength(0);
});
