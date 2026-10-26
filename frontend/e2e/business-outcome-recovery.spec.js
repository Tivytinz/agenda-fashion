import { expect, test } from '@playwright/test';

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const BUSINESS = { id: 11, nome: 'Studio novo', slug: 'studio-novo', papel: 'dono', areas: ['Unhas'], publicado: false,
  whatsapp: '11999999999', endereco: 'Rua local', numero: '20', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', cep: '01001000' };
for (const recovery of ['verificar', 'reload']) {
  test(`criação com resposta perdida retoma o primeiro serviço por ${recovery}`, async ({ page }) => {
    let created = false; let key; let writes = 0; let reads = 0;
    await page.addInitScript(() => {
      localStorage.setItem('session_active', '1');
      localStorage.setItem('af_marketing_consent_v2', JSON.stringify({ version: 2, status: 'denied', updatedAt: '2026-10-26T00:00:00Z' }));
    });
    await page.route('**/minha-sessao', route => json(route, { usuario: { id: 4, nome: 'Ana', whatsapp: '11999999999' },
      negocio: created ? BUSINESS : null, temNegocio: created, administrador: null, ehAdministrador: false }));
    await page.route('**/marketing/*/config', route => json(route, { enabled: false }));
    await page.route('**/consentimento', route => json(route, {}));
    await page.route('**/analytics/collect', route => json(route, {}));
    await page.route('**/eventos-produto', route => json(route, {}));
    await page.route('**/cep/01001000', route => json(route, BUSINESS));
    await page.route('**/criar-negocio', route => {
      if (route.request().isNavigationRequest()) return route.continue();
      writes++; key = route.request().headers()['idempotency-key']; created = true;
      return route.abort('failed');
    });
    await page.route('**/criar-negocio/tentativa', route => {
      reads++; expect(route.request().headers()['idempotency-key']).toBe(key);
      return json(route, { estado: 'concluida', negocio: BUSINESS, temNegocio: true });
    });
    await page.goto('/criar-negocio?plano=studio');
    await page.getByLabel('Nome do negócio').fill('Studio novo');
    await page.getByLabel('Unhas', { exact: true }).check();
    await page.getByLabel(/Link do Google Maps/).fill('https://maps.google.com/');
    await page.getByLabel(/CEP/).fill('01001000');
    await expect(page.getByLabel('Endereço', { exact: true })).toHaveValue('Rua local');
    await page.getByLabel('Número', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Criar negócio' }).click();
    await expect(page.getByRole('button', { name: 'Verificar negócio' })).toBeVisible();
    expect(key).toMatch(/^negocio-/);
    expect(new URL(page.url()).hash).toContain('cadastro-negocio');
    if (recovery === 'reload') await page.reload();
    else await page.getByRole('button', { name: 'Verificar negócio' }).click();
    await expect(page).toHaveURL(/\/painel\/servicos\/novo\?onboarding=servico&plano=studio$/);
    await expect(page.getByLabel('Nome do serviço')).toBeVisible();
    expect(writes).toBe(1); expect(reads).toBe(1);
  });
}
