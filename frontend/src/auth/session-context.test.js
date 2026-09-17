import { describe, expect, it } from "vitest";
import {
  getBusinessContextForPath,
  getBusinessWorkspacePath
} from "./session";

const session = {
  temNegocio: true,
  negocio: {
    id: 10,
    nome: "Negócio próprio",
    papel: "dono"
  },
  vinculos: [
    {
      id: 10,
      nome: "Negócio próprio",
      papel: "dono"
    },
    {
      id: 20,
      nome: "Studio onde atende",
      papel: "profissional"
    }
  ]
};

describe("contexto explícito de negócio", () => {
  it("usa o vínculo de dono nas rotas do painel", () => {
    expect(
      getBusinessContextForPath(session, "/painel/agenda")
    ).toMatchObject({
      id: 10,
      papel: "dono"
    });
  });

  it("usa o vínculo profissional nas rotas profissionais", () => {
    expect(
      getBusinessContextForPath(session, "/profissional/agenda")
    ).toMatchObject({
      id: 20,
      papel: "profissional"
    });
  });

  it("não cai silenciosamente no vínculo de dono para rota profissional", () => {
    const ownerOnly = {
      ...session,
      vinculos: [session.vinculos[0]]
    };

    expect(
      getBusinessContextForPath(ownerOnly, "/profissional/agenda")
    ).toBeNull();
  });

  it("pode abrir explicitamente a área profissional após aceite", () => {
    expect(
      getBusinessWorkspacePath(session, "profissional")
    ).toBe("/profissional/agenda");
  });
});
