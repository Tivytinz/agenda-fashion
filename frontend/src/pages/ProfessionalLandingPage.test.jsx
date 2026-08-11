import { describe, expect, it } from "vitest";

import {
  buildProfessionalSignupPath,
  PROFESSIONAL_TRACKING_PARAMS
} from "./ProfessionalLandingPage";

describe("landing para profissionais", () => {
  it("leva sempre ao cadastro profissional", () => {
    expect(buildProfessionalSignupPath(""))
      .toBe("/cadastro?tipo=profissional");
  });

  it("preserva somente parâmetros de atribuição conhecidos", () => {
    const path = buildProfessionalSignupPath(
      "?utm_source=google&utm_medium=cpc&utm_campaign=agosto&gclid=abc-123&redirect=https://malicioso.test&foo=bar"
    );
    const [, query = ""] = path.split("?");
    const params = new URLSearchParams(query);

    expect(params.get("tipo")).toBe("profissional");
    expect(params.get("utm_source")).toBe("google");
    expect(params.get("utm_medium")).toBe("cpc");
    expect(params.get("utm_campaign")).toBe("agosto");
    expect(params.get("gclid")).toBe("abc-123");
    expect(params.has("redirect")).toBe(false);
    expect(params.has("foo")).toBe(false);
  });

  it("mantém a lista de parâmetros alinhada com a atribuição do produto", () => {
    expect(PROFESSIONAL_TRACKING_PARAMS).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "gclid",
      "fbclid"
    ]);
  });
});
