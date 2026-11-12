// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureAnalyticsTabIsolation,
  parkAnalyticsOutbox,
  recoverParkedOutbox,
  pruneExpiredParkedOutboxes,
  releaseAnalyticsTab,
  scrubParkedAttribution,
  tabOutboxRecoveryInternals
} from "./tabOutboxRecovery";

const VISITOR_ID = "c0d7ad1c-bd64-4d5c-9a22-7d301cf6ac51";
const EVENT_ID = "1075488c-a6a1-4c13-b418-c5a88dd1d340";
const SESSION_ID = "da33543b-6f3c-42db-b4e4-e78b423233f2";
const ENTRY = {
  id: EVENT_ID,
  createdAt: Date.now(),
  payload: {
    visitorUuid: VISITOR_ID,
    sessionUuid: SESSION_ID,
    acquisition: { landingPage: "/cadastro", utmSource: "google", gclid: "click" },
    items: [{ type: "event", eventUuid: EVENT_ID, name: "profile_viewed" }]
  }
};

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  tabOutboxRecoveryInternals.simulateNewDocument();
});

describe("isolamento por guia e recuperação offline", () => {
  it("preserva a sessão V2 existente na implantação do marcador de guia", () => {
    const previousSession = JSON.stringify({
      id: SESSION_ID,
      lastActivityAt: Date.now(),
      sequence: 5,
      acquisition: { landingPage: "/para-profissionais" }
    });
    sessionStorage.setItem("af_analytics_session_v2", previousSession);
    expect(sessionStorage.getItem("af_analytics_tab_v1")).toBeNull();
    const tab = ensureAnalyticsTabIsolation();
    expect(tab).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessionStorage.getItem("af_analytics_session_v2")).toBe(previousSession);
  });

  it("duplica guia sem opener e descarta sessão e lote herdados", () => {
    const original = ensureAnalyticsTabIsolation();
    sessionStorage.setItem("af_analytics_session_v2",
      JSON.stringify({ id: SESSION_ID, lastActivityAt: Date.now() }));
    sessionStorage.setItem("af_analytics_outbox_v2", JSON.stringify([ENTRY]));
    sessionStorage.setItem("af_analytics_onboarding_flow_v2", SESSION_ID);
    tabOutboxRecoveryInternals.simulateNewDocument();

    const cloned = ensureAnalyticsTabIsolation();
    expect(cloned).not.toBe(original);
    expect(sessionStorage.getItem("af_analytics_session_v2")).toBeNull();
    expect(sessionStorage.getItem("af_analytics_outbox_v2")).toBeNull();
    expect(sessionStorage.getItem("af_analytics_onboarding_flow_v2")).toBeNull();
  });

  it("recupera lote de guia fechada no próximo documento da mesma identidade", () => {
    ensureAnalyticsTabIsolation();
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "conta-1", visitorId: VISITOR_ID });
    releaseAnalyticsTab();
    sessionStorage.clear();
    tabOutboxRecoveryInternals.simulateNewDocument();
    ensureAnalyticsTabIsolation();

    let received = [];
    const restored = recoverParkedOutbox({
      revision: "conta-1",
      visitorId: VISITOR_ID,
      entries: [],
      persist: entries => {
        received = entries;
        sessionStorage.setItem("af_analytics_outbox_v2", JSON.stringify(entries));
        return true;
      }
    });
    expect(restored).toBe(1);
    expect(received).toEqual([ENTRY]);
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(0);
  });

  it("não recupera lote se houve mudança de identidade", () => {
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "conta-A", visitorId: VISITOR_ID });
    releaseAnalyticsTab();
    tabOutboxRecoveryInternals.simulateNewDocument();
    const persist = () => { throw new Error("não deve persistir"); };
    expect(recoverParkedOutbox({
      revision: "conta-B", visitorId: VISITOR_ID, entries: [], persist
    })).toBe(0);
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(0);
  });

  it("não rouba lote de guia viva, mas recupera se a posse expirou", () => {
    const original = ensureAnalyticsTabIsolation();
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "conta-1", visitorId: VISITOR_ID });
    tabOutboxRecoveryInternals.simulateNewDocument();
    ensureAnalyticsTabIsolation();
    const persist = () => true;
    expect(recoverParkedOutbox({
      revision: "conta-1", visitorId: VISITOR_ID, entries: [], persist
    })).toBe(0);

    const ownerKey = "af_analytics_tab_owner_v1_" + original;
    const owner = JSON.parse(localStorage.getItem(ownerKey));
    localStorage.setItem(ownerKey, JSON.stringify({
      ...owner, lastSeenAt: Date.now() - 10 * 60 * 1000
    }));
    let received = [];
    expect(recoverParkedOutbox({
      revision: "conta-1", visitorId: VISITOR_ID, entries: [],
      persist: entries => { received = entries; return true; }
    })).toBe(1);
    expect(received).toEqual([ENTRY]);
  });

  it("mantém excedentes de outra guia até haver capacidade real", () => {
    const full = Array.from({ length: 40 }, (_, index) => ({
      ...ENTRY, id: `1075488c-a6a1-4c13-b418-${String(index).padStart(12, "0")}`
    }));
    const old = Array.from({ length: 3 }, (_, index) => ({
      ...ENTRY, id: `1075488c-a6a1-4c13-b419-${String(index).padStart(12, "0")}`
    }));
    parkAnalyticsOutbox({ entries: old, revision: "r", visitorId: VISITOR_ID });
    releaseAnalyticsTab();
    tabOutboxRecoveryInternals.simulateNewDocument();
    ensureAnalyticsTabIsolation();
    let received = [];
    const attempt = entries => { received = entries; return true; };
    const state = () => ({ revision: "r", visitorId: VISITOR_ID, persist: attempt });
    expect(recoverParkedOutbox({ ...state(), entries: full })).toBe(0);
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(1);
    expect(recoverParkedOutbox({ ...state(), entries: full.slice(1) })).toBe(1);
    expect(received).toHaveLength(40);
    expect(JSON.parse(localStorage.getItem(tabOutboxRecoveryInternals.parkedKeys()[0])).entries).toHaveLength(2);
    expect(recoverParkedOutbox({ ...state(), entries: received.slice(2) })).toBe(2);
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(0);
  });

  it("limpa snapshots expirados ao reabrir a aplicação", () => {
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "r", visitorId: VISITOR_ID });
    const key = tabOutboxRecoveryInternals.parkedKeys()[0];
    const record = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...record, savedAt: Date.now() - 25 * 60 * 60 * 1000
    }));
    pruneExpiredParkedOutboxes();
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(0);
  });

  it("preserva snapshot quando a fila de destino falha ao gravar", () => {
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "", visitorId: VISITOR_ID });
    releaseAnalyticsTab();
    tabOutboxRecoveryInternals.simulateNewDocument();
    expect(recoverParkedOutbox({
      revision: "", visitorId: VISITOR_ID, entries: [], persist: () => false
    })).toBe(0);
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(1);
  });

  it("revogação remove UTMs e IDs de clique dos lotes persistidos", () => {
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "", visitorId: VISITOR_ID });
    scrubParkedAttribution(acquisition => ({
      landingPage: acquisition.landingPage
    }));
    const key = tabOutboxRecoveryInternals.parkedKeys()[0];
    const record = JSON.parse(localStorage.getItem(key));
    expect(record.entries[0].payload.acquisition).toEqual({
      landingPage: "/cadastro"
    });
  });

  it("diário vazio remove o snapshot da mesma guia", () => {
    parkAnalyticsOutbox({ entries: [ENTRY], revision: "", visitorId: VISITOR_ID });
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(1);
    parkAnalyticsOutbox({ entries: [], revision: "", visitorId: VISITOR_ID });
    expect(tabOutboxRecoveryInternals.parkedKeys()).toHaveLength(0);
  });
});
