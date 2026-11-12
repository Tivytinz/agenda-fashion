import { expect, test } from "@playwright/test";

async function analyticsSession(page) {
  return page.evaluate(() => ({
    tab: sessionStorage.getItem("af_analytics_tab_v1"),
    session: JSON.parse(sessionStorage.getItem("af_analytics_session_v2") || "null")
  }));
}

test("guia clonada sem opener recebe nova sessão V2, sem herdar a fila", async ({ page, context }) => {
  await page.route("**/analytics/collect", route => route.abort());
  await page.goto("/para-profissionais");
  await expect.poll(async () => (await analyticsSession(page)).session?.id).toMatch(
    /^[0-9a-f-]{36}$/
  );
  const original = await analyticsSession(page);
  const copiedStorage = await page.evaluate(() => Object.fromEntries(
    Object.entries(sessionStorage)
  ));

  const clone = await context.newPage();
  await clone.addInitScript(storage => {
    // Simula o sessionStorage copiado pelo comando "Duplicar guia", sem opener.
    for (const [key, value] of Object.entries(storage)) sessionStorage.setItem(key, value);
  }, copiedStorage);
  await clone.route("**/analytics/collect", route => route.abort());
  await clone.goto("/para-profissionais");
  await expect.poll(async () => (await analyticsSession(clone)).session?.id).not.toBe(original.session.id);
  const next = await analyticsSession(clone);

  expect(next.tab).not.toBe(original.tab);
  expect(next.session.id).not.toBe(original.session.id);
  expect(await clone.evaluate(oldId => JSON.parse(
    sessionStorage.getItem("af_analytics_outbox_v2") || "[]"
  ).every(entry => entry.payload.sessionUuid !== oldId), original.session.id)).toBe(true);
  await clone.close();
});

test("lote offline sobrevive ao fechamento e reaparece no próximo acesso", async ({ page, context }) => {
  await page.route("**/analytics/collect", route => route.abort());
  await page.goto("/para-profissionais");
  await expect.poll(async () => page.evaluate(() => (
    Object.keys(localStorage).filter(key => key.startsWith("af_analytics_parked_v1_")).length
  ))).toBeGreaterThan(0);
  const original = await analyticsSession(page);

  // Garante pagehide inclusive em navegadores que não o emitem no fechamento.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.close();

  const replay = await context.newPage();
  const delivered = [];
  await replay.route("**/analytics/collect", async route => {
    const body = route.request().postDataJSON();
    delivered.push(body.sessionUuid);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ recebido: true })
    });
  });
  await replay.goto("/para-profissionais");
  await expect.poll(() => delivered.includes(original.session.id)).toBe(true);
  await replay.close();
});
