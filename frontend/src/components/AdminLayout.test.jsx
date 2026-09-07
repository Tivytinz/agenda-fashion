import {
  describe,
  expect,
  it
} from "vitest";
import { ADMIN_LINKS } from "./AdminLayout";

describe("navegação administrativa", () => {
  it("mantém apenas módulos do AF no nível principal", () => {
    expect(ADMIN_LINKS).toEqual([
      ["/admin", "Visão geral", "home"],
      ["/admin/saude", "Ativação", "health"],
      ["/admin/operacao", "Operação", "business"],
      ["/admin/trafego-pago", "Marketing", "marketing"],
      ["/admin/whatsapp", "WhatsApp", "whatsapp"]
    ]);
    expect(ADMIN_LINKS.some(([path]) => path === "/conta")).toBe(false);
  });
});
