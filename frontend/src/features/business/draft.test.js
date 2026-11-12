// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBusinessCreationDraft, readBusinessCreationDraft,
  saveBusinessCreationDraft
} from "./draft";
import { tabOutboxRecoveryInternals } from "../../analytics/tabOutboxRecovery";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  tabOutboxRecoveryInternals.simulateNewDocument();
  vi.useRealTimers();
});

describe("rascunho temporário de criação", () => {
  it("restaura os campos na mesma conta e somente na guia", () => {
    saveBusinessCreationDraft(7, { nome: "Studio A", areas: ["Unhas"], whatsapp: "62999999999" });
    expect(readBusinessCreationDraft(7)).toMatchObject({ nome: "Studio A", areas: ["Unhas"] });
    expect(localStorage.getItem("af_business_creation_draft_v1")).toBeNull();
  });
  it("não restaura rascunho copiado por duplicação nativa sem window.opener", () => {
    saveBusinessCreationDraft(7, { nome: "Studio privado", whatsapp: "62999999999" });
    expect(readBusinessCreationDraft(7)?.nome).toBe("Studio privado");
    // Simula novo documento com cópia do sessionStorage e posse local original.
    tabOutboxRecoveryInternals.simulateNewDocument();
    expect(readBusinessCreationDraft(7)).toBeNull();
    expect(sessionStorage.getItem("af_business_creation_draft_v1")).toBeNull();
  });

  it("descarta rascunho de outra conta", () => {
    saveBusinessCreationDraft(7, { nome: "Studio A" });
    expect(readBusinessCreationDraft(8)).toBeNull();
    expect(readBusinessCreationDraft(7)).toBeNull();
  });
  it("descarta após 30 minutos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
    saveBusinessCreationDraft(7, { nome: "Studio A" });
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(readBusinessCreationDraft(7)).toBeNull();
    vi.useRealTimers();
  });
  it("é removido após conclusão ou saída explícita", () => {
    saveBusinessCreationDraft(7, { nome: "Studio A" });
    clearBusinessCreationDraft();
    expect(readBusinessCreationDraft(7)).toBeNull();
  });
});
