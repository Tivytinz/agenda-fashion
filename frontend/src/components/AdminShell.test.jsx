// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AdminLayout } from "./AdminLayout";

function renderAdmin(path = "/admin/aquisicao") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminLayout><h1>Conteúdo administrativo</h1></AdminLayout>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("AdminShell", () => {
  it("mantém shell independente, atalhos de acesso e limpeza do contexto", () => {
    const view = renderAdmin();
    expect(document.querySelector(".admin-shell")).not.toBeNull();
    expect(document.querySelector(".workspace-shell")).toBeNull();
    expect(document.documentElement.classList.contains("admin-context-active"))
      .toBe(true);
    expect(screen.getByRole("complementary", {
      name: "Administração do Agenda Fashion"
    })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })
      .getAttribute("href")).toBe("#admin-main");
    expect(document.querySelector("#admin-main")?.getAttribute("tabindex"))
      .toBe("-1");

    view.unmount();
    expect(document.documentElement.classList.contains("admin-context-active"))
      .toBe(false);
  });

  it("mostra todas as páginas no sidebar e seleciona a página exata", () => {
    renderAdmin("/admin/trafego-pago/custos?periodo=7");
    const navigation = screen.getByRole("navigation", {
      name: "Módulos administrativos"
    });

    expect(navigation.querySelectorAll(".admin-nav-link")).toHaveLength(11);
    expect(screen.getByRole("heading", { name: "Crescimento" })).not.toBeNull();
    expect(navigation.querySelector("a[href='/admin/trafego-pago/custos?periodo=7']")
      .classList.contains("active")).toBe(true);
    expect(navigation.querySelector("a[href='/admin/trafego-pago/custos?periodo=7']")
      .getAttribute("aria-current")).toBe("page");
    expect(navigation.querySelector("a[href='/admin/trafego-pago?periodo=7']")
      .classList.contains("active")).toBe(false);
    expect(navigation.querySelector("a[href='/admin/integracoes']")?.textContent)
      .toBe("Integrações");
    expect(navigation.querySelector("a[href='/admin/saude']")?.textContent)
      .toBe("Saúde do SaaS");
    expect(navigation.querySelector("a[href='/admin/operacao']"))
      .not.toBeNull();
  });

  it("seleciona WhatsApp e Integrações pelos links próprios", () => {
    const view = renderAdmin("/admin/whatsapp");
    expect(document.querySelector(".admin-sidebar a[href='/admin/whatsapp']")
      .classList.contains("active")).toBe(true);
    view.unmount();

    renderAdmin("/admin/integracoes");
    expect(document.querySelector(".admin-sidebar a[href='/admin/integracoes']")
      .classList.contains("active")).toBe(true);
  });

  it("abre no celular a mesma navegação e fecha pelo botão", async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const navigation = screen.getByRole("navigation", {
      name: "Navegação mobile da administração"
    });
    expect(navigation.querySelectorAll(".admin-nav-link")).toHaveLength(11);
    expect(screen.getByRole("button", { name: "Menu" })
      .getAttribute("aria-expanded")).toBe("true");
    expect(navigation.querySelector("a[href='/admin/saude']"))
      .not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.getByRole("button", { name: "Menu" })
      .getAttribute("aria-expanded")).toBe("false");
  });

  it("propaga só períodos válidos para módulos que compartilham o recorte", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/jornada?periodo=7&aba=ignorada");

    const desktop = screen.getByRole("navigation", {
      name: "Módulos administrativos"
    });
    expect(desktop.querySelector("a[href='/admin/retencao?periodo=7']"))
      .not.toBeNull();
    expect(desktop.querySelector("a[href='/admin/trafego-pago?periodo=7']"))
      .not.toBeNull();
    expect(desktop.querySelector("a[href='/admin/trafego-pago/custos?periodo=7']"))
      .not.toBeNull();
    expect(desktop.querySelector("a[href='/admin/operacao']"))
      .not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const mobile = screen.getByRole("navigation", {
      name: "Navegação mobile da administração"
    });
    expect(mobile.querySelector("a[href='/admin/receita?periodo=7']"))
      .not.toBeNull();
    expect(mobile.querySelector("a[href='/admin/saude']"))
      .not.toBeNull();
  });
});
