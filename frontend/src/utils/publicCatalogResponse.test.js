import { expect, it } from "vitest";
import { parsePublicCatalogResponse } from "./publicCatalogResponse";
it.each([null, [], { negocios: [null] }, { negocios: [{ id: true }] },
  { negocios: [{ id: 9007199254740992 }] }, { negocios: [{ id: "9223372036854775808" }] },
  { negocios: [{ id: 1, nome: {} }] }, { negocios: [{ id: 1, servicos: [null] }] },
  { localidades: [null] }, { paginacao: { tem_mais: "false" } }
])("recusa resposta inválida antes da renderização: %j", (response) => {
  expect(() => parsePublicCatalogResponse(response)).toThrow("Não foi possível ler");
});
it("preserva IDs BIGINT sem converter para Number", () => {
  const response = { negocios: [{ id: "9223372036854775807", servicos: [{ id: "9223372036854775806" }] }] };
  expect(parsePublicCatalogResponse(response)).toEqual(response);
});
