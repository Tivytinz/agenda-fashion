import { describe, expect, it } from "vitest";
import { settleRequestMap } from "./asyncData";

describe("carregamento parcial de dados", () => {
  it("preserva respostas válidas quando uma seção falha", async () => {
    const result = await settleRequestMap({
      resumo: Promise.resolve({ total: 3 }),
      campanhas: Promise.reject(new Error("indisponível"))
    });

    expect(result.values).toEqual({ resumo: { total: 3 } });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].key).toBe("campanhas");
  });
});
