import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { classifyProfessionalSignupRequestError as classify } from "./professionalSignupRequestError";

describe("classificação segura de falhas no cadastro profissional", () => {
  it.each([
    [409, "conflict"],
    [400, "invalid_request"],
    [422, "invalid_request"],
    [401, "auth_rejected"],
    [403, "auth_rejected"],
    [429, "rate_limited"],
    [408, "timeout"],
    [503, "server_error"],
    [500, "server_error"]
  ])("classifica status HTTP %s como %s", (status, expected) => {
    expect(classify(new ApiError("Possível dado sensível", status))).toBe(expected);
  });

  it("separa timeout e falha de rede, sem usar mensagens", () => {
    expect(classify(new ApiError("Detalhes livres", 408, { codigo: "REQUEST_TIMEOUT" })))
      .toBe("timeout");
    expect(classify(new TypeError("Falha ao alcançar https://site.test?email=privado"))).toBe("network_error");
    expect(classify(new Error("Conta de usuario@exemplo.com"))).toBe("unknown");
    expect(classify(new DOMException("Solicitação cancelada", "AbortError"))).toBeNull();
  });
});
