import { describe, expect, it } from "vitest";
import {
  getAuthDestination,
  getBusinessWorkspacePath,
  getWorkspacePath,
  normalizePlanSlug,
  safeInternalPath
} from "./session";

describe("destino da sessão", () => {
  it("leva contas sem negócio para o onboarding", () => {
    expect(getWorkspacePath({ temNegocio: false })).toBe("/criar-negocio");
  });

  it("leva administradores para a administração mesmo quando também possuem negócio", () => {
    expect(getWorkspacePath({
      ehAdministrador: true,
      temNegocio: true,
      negocio: { papel: "dono" }
    })).toBe("/admin/trafego-pago");
    expect(getBusinessWorkspacePath({
      ehAdministrador: true,
      temNegocio: true,
      negocio: { papel: "dono" }
    })).toBe("/painel");
  });

  it("leva a dona ao painel", () => {
    expect(getWorkspacePath({
      temNegocio: true,
      negocio: { papel: "dono" }
    })).toBe("/painel");
  });

  it("leva a profissional à própria agenda", () => {
    expect(getWorkspacePath({
      temNegocio: true,
      negocio: { papel: "profissional" }
    })).toBe("/profissional/agenda");
  });
});

describe("continuidade do plano escolhido", () => {
  it("normaliza somente slugs de plano seguros", () => {
    expect(normalizePlanSlug("Autonoma-Pro")).toBe("autonoma-pro");
    expect(normalizePlanSlug("../../checkout")).toBe("");
    expect(safeInternalPath("/checkout?plano=autonoma")).toContain("/checkout");
    expect(safeInternalPath("//site-malicioso.test")).toBe("");
  });

  it("leva uma nova profissional ao negócio e depois ao checkout", () => {
    expect(getAuthDestination({ temNegocio: false }, {
      planSlug: "autonoma"
    })).toBe("/criar-negocio?plano=autonoma");

    expect(getAuthDestination({
      temNegocio: true,
      negocio: { papel: "dono" }
    }, {
      planSlug: "autonoma"
    })).toBe("/checkout?plano=autonoma");
  });

  it("transforma um checkout protegido em onboarding sem perder o plano", () => {
    expect(getAuthDestination({ temNegocio: false }, {
      requestedPath: "/checkout?plano=autonoma"
    })).toBe("/criar-negocio?plano=autonoma");
  });
});
