import { expect, test } from '@playwright/test';

const BUSINESS = {
  id: 11, slug: 'studio-aurora', nome: 'Studio Aurora', papel: 'dono', publicado: true
};
const photo = id => ({ id, foto_url: `https://img.example/${id}.png`, foto_public_id: `photo-${id}` });
const PHOTOS = [photo(31), photo(32), photo(33)];
const SERVICE = { ...photo(31), id: 12, nome: 'Manicure', categoria: 'unha', valor: 50, duracao_minutos: 60, ativo: true };
const OTHER = { ...SERVICE, id: 34, nome: 'Pedicure', foto_url: '', foto_public_id: '' };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=', 'base64');

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('session_active', '1');
    localStorage.setItem('usuario', JSON.stringify({ id: 4, nome: 'Ana' }));
    localStorage.setItem('negocio', JSON.stringify({ id: 11, nome: 'Studio Aurora', papel: 'dono' }));
    localStorage.setItem('af_marketing_consent_v2', JSON.stringify({ version: 2, status: 'denied', updatedAt: '2026-10-10T00:00:00.000Z' }));
  });
  await page.route('**/minha-sessao', route => json(route, {
    usuario: { id: 4, nome: 'Ana', email: 'ana@example.com' }, negocio: BUSINESS,
    temNegocio: true, administrador: null, ehAdministrador: false
  }));
  await page.route('**/marketing/meta/config', route => json(route, { enabled: false, pixelId: null }));
  await page.route('**/marketing/google/config', route => json(route, { enabled: false, measurementId: null }));
  await page.route('**/consentimento', route => json(route, {}));
  await page.route('**/analytics/collect', route => json(route, {}));
  await page.route('**/eventos-produto', route => json(route, {}));
  await page.route('**/servicos', route => route.request().isNavigationRequest()
    ? route.continue()
    : json(route, { servicos: [SERVICE, OTHER] }));
  await page.route('**/minha-assinatura', route => json(route, {}));
  await page.route('**/servicos/12/fotos', route => json(route, PHOTOS));
  await page.route('**/servicos/34/fotos', route => json(route, []));
  await page.route('https://img.example/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
}

test('adicionar outro lote mantém e envia as fotos selecionadas anteriormente', async ({ page }) => {
  await setup(page);
  const sent = [];
  await page.route('**/servicos/12', route => json(route, { servico: SERVICE }));
  await page.route('**/servicos/12/fotos', route => {
    if (route.request().method() !== 'POST') return json(route, PHOTOS);
    sent.push(route.request().postDataBuffer().toString('utf8').match(/filename="([^"]+)"/)[1]);
    return json(route, { foto: photo(40 + sent.length) }, 201);
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByLabel('Nome do serviço')).toHaveValue('Manicure');
  const input = page.getByLabel('Adicionar fotos à galeria');
  await input.setInputFiles({ name: 'primeira.png', mimeType: 'image/png', buffer: png });
  await input.setInputFiles({ name: 'segunda.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('2 fotos selecionadas.')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  expect(sent).toEqual(['primeira.png', 'segunda.png']);
});

test('remover a capa bloqueia ações concorrentes e depois permite escolher outra', async ({ page }) => {
  await setup(page);
  let deletion;
  const chosen = [];
  await page.route('**/servicos/fotos/31', route => { deletion = route; });
  await page.route('**/servicos/12/capa', route => {
    chosen.push(route.request().postDataJSON().foto_id);
    return json(route, { servico: { ...SERVICE, ...photo(chosen.at(-1)), id: 12 } });
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByText('Capa atual', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remover foto da galeria' }).nth(0).click();
  await expect.poll(() => Boolean(deletion)).toBe(true);
  for (const button of await page.getByRole('button', { name: 'Usar como capa' }).all()) await expect(button).toBeDisabled();
  for (const button of await page.getByRole('button', { name: 'Remover foto da galeria' }).all()) await expect(button).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvar serviço' })).toBeDisabled();
  await expect(page.getByLabel('Adicionar fotos à galeria')).toBeDisabled();
  expect(chosen).toEqual([]);
  await json(deletion, { capa_removida: true, servico_id: 12 });
  await expect(page.getByRole('button', { name: 'Remover foto da galeria' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Usar como capa' }).nth(1).click();
  await expect(page.getByAltText('Capa atual do serviço Manicure')).toHaveAttribute('src', photo(33).foto_url);
  await expect(page.getByText('Capa atual', { exact: true })).toBeVisible();
  expect(chosen).toEqual([33]);
});

test('falha ao escolher capa preserva o arquivo pendente e permite salvá-lo', async ({ page }) => {
  await setup(page);
  let uploaded;
  await page.route('**/servicos/12/capa', route => json(route, { mensagem: 'Capa indisponível' }, 503));
  await page.route('**/servicos/12', route => json(route, { servico: SERVICE }));
  await page.route('**/servicos/12/foto', route => {
    uploaded = route.request().postDataBuffer().toString('utf8').match(/filename="([^"]+)"/)[1];
    return json(route, { servico: { ...SERVICE, ...photo(50), id: 12 } });
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByText('Capa atual', { exact: true })).toBeVisible();
  await page.locator('.cover-upload input[type=file]').setInputFiles({ name: 'pendente.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Usar como capa' }).nth(0).click();
  await expect(page.getByRole('alert')).toContainText('Capa indisponível');
  await expect(page.getByAltText('Prévia da nova capa')).toBeVisible();
  await page.getByRole('link', { name: 'Voltar aos serviços' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sair sem salvar?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar editando' }).click();
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  expect(uploaded).toBe('pendente.png');
});

test('um salvamento antigo não tira a dona do novo editor nem altera seu rascunho', async ({ page }) => {
  await setup(page);
  let pending;
  const writes = [];
  await page.route('**/servicos/12', route => {
    writes.push({ id: 12, body: route.request().postDataJSON() });
    pending = route;
  });
  await page.route('**/servicos/34', route => {
    writes.push({ id: 34, body: route.request().postDataJSON() });
    return json(route, { servico: OTHER });
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByLabel('Nome do serviço')).toHaveValue('Manicure');
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole('link', { name: 'Voltar aos serviços' }).click();
  await page.getByRole('link', { name: 'Editar', exact: true }).nth(1).click();
  const name = page.getByLabel('Nome do serviço');
  await expect(name).toHaveValue('Pedicure');
  await name.fill('Pedicure corrigida');
  const finished = page.waitForEvent('requestfinished', request => request.method() === 'PUT' && request.url().endsWith('/servicos/12'));
  await json(pending, { servico: SERVICE });
  await finished;
  await expect(page).toHaveURL(/\/painel\/servicos\/34\/editar$/);
  await expect(name).toHaveValue('Pedicure corrigida');
  await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  expect(writes.map(write => write.id)).toEqual([12, 34]);
  expect(writes[1].body.nome).toBe('Pedicure corrigida');
});

test('ações de remover e adicionar foto têm área de toque de pelo menos 44px e o catálogo cabe na tela', async ({ page }) => {
  await setup(page);
  await page.goto('/painel/servicos');
  const remove = page.getByRole('button', { name: 'Remover', exact: true }).first();
  const add = page.getByRole('link', { name: 'Adicionar foto', exact: true }).first();
  await expect(remove).toBeVisible();
  await expect(add).toBeVisible();
  for (const action of [remove, add]) {
    const box = await action.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
});
