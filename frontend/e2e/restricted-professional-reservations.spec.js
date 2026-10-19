import { expect, test } from "@playwright/test";

const item = { id: 11, negocio: "Studio Aurora", cliente: "Clara", servico: "Manicure", data: "2026-10-12", horario: "10:00", status: "confirmado", pode_marcar_realizado: true, pode_marcar_falta: true };
const json = (route, value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({ version: 2, status: "denied", updatedAt: "2026-10-15T00:00:00Z" }));
  });
  await page.route("**/minha-sessao", (route) => json(route, { usuario: { id: 7, nome: "Ana", perfil_profissional_ativo: true }, negocio: null, vinculos: [], temNegocio: false, temReservasProfissionaisRestritas: true }));
  for (const path of ["marketing/meta/config", "marketing/google/config"]) await page.route(`**/${path}`, (route) => json(route, { enabled: false }));
  for (const path of ["consentimento", "analytics/collect", "eventos-produto"]) await page.route(`**/${path}`, (route) => json(route, {}));
  await page.route("**/reservas-profissionais-existentes?*", (route) => json(route, { agendamentos: [item], pagina: 1, tem_proxima: false }));
}

test("RN50: consulta e resultado no mobile, com envio único", async ({ page }, testInfo) => {
  await setup(page);
  let save;
  let writes = 0;
  await page.route("**/agendamentos/11/atendimento", (route) => { save = route; writes += 1; });
  await page.goto("/reservas-existentes");
  await expect(page.getByRole("heading", { name: "Reservas existentes" })).toBeVisible();
  await expect(page.getByText("Studio Aurora")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar realizado" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancelar|Reagendar|Iniciar atendimento/i })).toHaveCount(0);
  const dimensions = await page.getByRole("button", { name: "Marcar realizado" }).boundingBox();
  expect(dimensions.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("reservas-consulta.png"), fullPage: true });
  await page.getByRole("button", { name: "Marcar realizado" }).click();
  await page.getByRole("button", { name: "Confirmar realizado" }).click();
  await expect.poll(() => Boolean(save)).toBe(true);
  await expect(page.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Atualizar reservas" })).toBeDisabled();
  expect(save.request().postDataJSON()).toEqual({ status: "realizado" });
  expect(writes).toBe(1);
  await json(save, { mensagem: "Atendimento marcado como realizado.", agendamento: { id: 11, status: "realizado" } });
  await expect(page.getByText("Atendimento marcado como realizado.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar realizado" })).toHaveCount(0);
});

test("RN50: falha preserva confirmação e permite nova tentativa", async ({ page }) => {
  await setup(page);
  let writes = 0;
  await page.route("**/agendamentos/11/atendimento", (route) => {
    writes += 1;
    return writes === 1 ? json(route, { erro: "Falha temporária" }, 503) : json(route, { mensagem: "Falta registrada.", agendamento: { status: "falta" } });
  });
  await page.goto("/reservas-existentes");
  await page.getByRole("button", { name: "Registrar falta" }).click();
  await page.getByRole("button", { name: "Confirmar falta" }).click();
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await page.getByRole("button", { name: "Confirmar falta" }).click();
  await expect(page.getByText("Falta registrada.")).toBeVisible();
  expect(writes).toBe(2);
});

test("RN50: menu, estado vazio e recuperação de leitura", async ({ page }) => {
  await setup(page);
  let failing = true;
  await page.route("**/reservas-profissionais-existentes?*", (route) => {
    return failing ? json(route, { erro: "Falha na consulta" }, 503) : json(route, { agendamentos: [], pagina: 1, tem_proxima: false });
  });
  await page.goto("/reservas-existentes");
  await expect(page.getByRole("alert")).toContainText("Falha na consulta");
  failing = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Nenhuma reserva disponível")).toBeVisible();
  await page.getByRole("button", { name: "Abrir conta de Ana" }).click();
  await expect(page.getByRole("link", { name: "Reservas existentes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para área de trabalho" })).toHaveCount(0);
});

test("RN50: sessão expirada encaminha para autenticação", async ({ page }) => {
  await setup(page);
  await page.route("**/reservas-profissionais-existentes?*", (route) => json(route, { erro: "Sessão expirada" }, 401));
  await page.goto("/reservas-existentes");
  await expect(page).toHaveURL(/\/entrar/);
});

test("RN50: link antigo da agenda abre a área restrita", async ({ page }) => {
  await setup(page);
  await page.goto("/profissional/agenda");
  await expect(page).toHaveURL(/\/reservas-existentes$/);
  await expect(page.getByRole("heading", { name: "Reservas existentes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Meus horários" })).toHaveCount(0);
});
