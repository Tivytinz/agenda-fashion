import { expect, test } from "@playwright/test";

function credenciaisUnicas() {
  const sufixo = String(Date.now()).slice(-8);

  return {
    nome: "Acceptance Full Stack",
    email: `acceptance.fullstack.${Date.now()}@teste.local`,
    whatsapp: `629${sufixo}`,
    senha: "senha-fullstack-123"
  };
}

test("cadastro profissional persiste sessão real em cookie HttpOnly", async ({ page }) => {
  const usuario = credenciaisUnicas();

  const antes = await page.request.get("/minha-sessao");
  expect(antes.status()).toBe(401);

  await page.addInitScript(() => {
    localStorage.setItem(
      "af_marketing_consent_v2",
      JSON.stringify({
        version: 2,
        status: "denied",
        updatedAt: "2026-09-21T00:00:00.000Z"
      })
    );
  });

  await page.goto("/cadastro?tipo=profissional");

  await page.getByLabel("Nome completo").fill(usuario.nome);
  await page.getByLabel("E-mail").fill(usuario.email);
  await page.getByLabel("WhatsApp com DDD").fill(usuario.whatsapp);
  await page.getByLabel("Senha", { exact: true }).fill(usuario.senha);
  await page.getByLabel("Confirme a senha").fill(usuario.senha);

  const cadastro = page.waitForResponse((response) =>
    response.url().endsWith("/cadastro") &&
    response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Criar conta" }).click();

  const respostaCadastro = await cadastro;
  expect(respostaCadastro.status()).toBe(201);
  await expect(page).toHaveURL(/\/criar-negocio$/);

  const sessao = await page.request.get("/minha-sessao");
  expect(sessao.status()).toBe(200);

  const corpo = await sessao.json();
  expect(corpo.usuario).toMatchObject({
    nome: usuario.nome,
    email: usuario.email,
    whatsapp: usuario.whatsapp
  });
  expect(corpo.temNegocio).toBe(false);

  const cookies = await page.context().cookies();
  const cookieSessao = cookies.find((cookie) =>
    ["af_session", "__Host-af_session"].includes(cookie.name)
  );

  expect(cookieSessao).toBeTruthy();
  expect(cookieSessao.httpOnly).toBe(true);
  expect(cookieSessao.sameSite).toBe("Lax");

  const logout = await page.request.post("/logout");
  expect(logout.status()).toBe(204);

  const depois = await page.request.get("/minha-sessao");
  expect(depois.status()).toBe(401);
});
