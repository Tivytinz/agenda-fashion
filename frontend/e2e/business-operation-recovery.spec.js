import { expect, test } from '@playwright/test';

const BUSINESS = {
  id: 11, slug: 'studio-aurora', nome: 'Studio Aurora', descricao: '',
  whatsapp: '11999999999', cidade: 'São Paulo', estado: 'SP', bairro: 'Centro',
  endereco: 'Rua das Flores', numero: '10', cep: '01001000', areas: ['Unhas'],
  localizacao_url: 'https://maps.google.com/?q=studio', papel: 'dono', publicado: true
};
const LIVE = { publicado: true, pode_publicar: true, pendencias: [] };
const HIDDEN = { publicado: false, pode_publicar: true, pendencias: [], oculto_manual: true };
const SERVICE = { id: 12, nome: 'Manicure', categoria: 'unha', valor: 50, duracao_minutos: 60, ativo: true };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function setup(page, { creating = false, business = BUSINESS, publication = LIVE } = {}) {
  let currentBusiness = creating ? null : business;
  let sessionReads = 0;
  await page.addInitScript(({ creating }) => {
    localStorage.setItem('session_active', '1');
    localStorage.setItem('usuario', JSON.stringify({ id: 4, nome: 'Ana' }));
    if (!creating) localStorage.setItem('negocio', JSON.stringify({ id: 11, nome: 'Studio Aurora', papel: 'dono' }));
    localStorage.setItem('af_marketing_consent_v2', JSON.stringify({ version: 2, status: 'denied', updatedAt: '2026-10-10T00:00:00.000Z' }));
  }, { creating });
  await page.route('**/minha-sessao', route => {
    sessionReads += 1;
    return json(route, { usuario: { id: 4, nome: 'Ana', email: 'ana@example.com', perfil_profissional: true }, negocio: currentBusiness, temNegocio: Boolean(currentBusiness), administrador: null, ehAdministrador: false });
  });
  for (const path of ['marketing/meta/config', 'marketing/google/config']) await page.route(`**/${path}`, route => json(route, { enabled: false }));
  for (const path of ['consentimento', 'analytics/collect', 'eventos-produto', 'minha-assinatura']) await page.route(`**/${path}`, route => json(route, {}));
  await page.route('**/servicos', route => route.request().isNavigationRequest() ? route.continue() : json(route, { servicos: [SERVICE] }));
  await page.route('**/servicos/12/fotos', route => json(route, []));
  await page.route('**/configuracoes', route => json(route, { negocio: business, publicacao: publication }));
  await page.route('**/negocios-publicos**', route => json(route, { negocios: [] }));
  return { sessionReads: () => sessionReads, setBusiness: value => { currentBusiness = value; } };
}

async function finishMutation(page, route, body, status = 200) {
  const request = route.request();
  const finished = page.waitForEvent('requestfinished', candidate => candidate === request);
  await json(route, body, status);
  await finished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('salvamento e publicação aguardam um ao outro e preservam a ocultação confirmada', async ({ page }) => {
  await setup(page);
  let pendingSave;
  let pendingPublication;
  let publication = LIVE;
  let business = BUSINESS;
  await page.route('**/configuracoes', route => {
    if (route.request().method() === 'PUT') { pendingSave = route; return; }
    return json(route, { negocio: business, publicacao: publication });
  });
  await page.route('**/configuracoes/publicacao', route => { pendingPublication = route; });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/painel/negocio');
  const name = page.getByLabel('Nome do negócio');
  await name.fill('Studio revisado');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => Boolean(pendingSave)).toBe(true);
  await expect(page.getByRole('button', { name: 'Ocultar da busca' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Encerrar negócio', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Adicionar foto', { exact: true })).toBeDisabled();
  expect(pendingPublication).toBeUndefined();
  business = { ...BUSINESS, nome: 'Studio revisado' };
  await finishMutation(page, pendingSave, { negocio: business, publicacao: publication });
  await page.getByRole('button', { name: 'Ocultar da busca' }).click();
  await expect.poll(() => Boolean(pendingPublication)).toBe(true);
  await name.fill('Studio preservado');
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
  await expect(page.getByLabel('Adicionar foto', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Encerrar negócio', exact: true })).toBeDisabled();
  publication = HIDDEN;
  await finishMutation(page, pendingPublication, { publicacao: publication });
  await expect(page.getByRole('heading', { name: 'Seu negócio não está aparecendo na busca' })).toBeVisible();
  const firstSave = pendingSave;
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => pendingSave !== firstSave).toBe(true);
  expect(pendingSave.request().postDataJSON().nome).toBe('Studio preservado');
  business = { ...business, nome: 'Studio preservado' };
  await finishMutation(page, pendingSave, { negocio: business, publicacao: publication });
  await expect(name).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Mostrar na busca' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Seu negócio não está aparecendo na busca' })).toBeVisible();
});

test('falha de publicação libera os controles e mantém o rascunho protegido', async ({ page }) => {
  await setup(page);
  let pending;
  let saved;
  await page.route('**/configuracoes/publicacao', route => { pending = route; });
  await page.route('**/configuracoes', route => {
    if (route.request().method() === 'PUT') {
      saved = route.request().postDataJSON();
      return json(route, { negocio: { ...BUSINESS, ...saved }, publicacao: LIVE });
    }
    return json(route, { negocio: BUSINESS, publicacao: LIVE });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/painel/negocio');
  await page.getByLabel('Nome do negócio').fill('Rascunho preservado');
  await page.getByRole('button', { name: 'Ocultar da busca' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
  await finishMutation(page, pending, { mensagem: 'Publicação indisponível' }, 503);
  await expect(page.getByRole('alert')).toContainText('Publicação indisponível');
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  await page.getByRole('navigation', { name: 'Área de trabalho' }).getByRole('link', { name: /Serviços/ }).click();
  await page.getByRole('dialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Continuar editando' }).click();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => saved?.nome).toBe('Rascunho preservado');
});

test('resposta antiga do perfil em onboarding mantém a dona no novo editor com seu rascunho', async ({ page }) => {
  const business = { ...BUSINESS, numero: '', publicado: false };
  const state = await setup(page, { business, publication: { publicado: false, pode_publicar: false, pendencias: ['número'] } });
  let pending;
  await page.route('**/servicos', route => {
    if (route.request().isNavigationRequest()) return route.continue();
    return route.request().method() === 'POST' ? json(route, { servico: SERVICE, publicacao: { publicado: false } }) : json(route, { servicos: [SERVICE] });
  });
  await page.route('**/configuracoes', route => {
    if (route.request().method() === 'PUT') { pending = route; return; }
    return json(route, { negocio: business, publicacao: { publicado: false, pode_publicar: false, pendencias: ['número'] } });
  });
  await page.goto('/painel/servicos/novo?onboarding=servico');
  await page.getByLabel('Nome do serviço').fill('Manicure');
  await page.getByRole('combobox', { name: /^Categoria/ }).selectOption('unha');
  await page.getByLabel('Valor', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Salvar serviço e publicar' }).click();
  await expect(page).toHaveURL(/\/painel\/negocio$/);
  await page.getByLabel('Número', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole('navigation', { name: 'Área de trabalho' }).getByRole('link', { name: /Serviços/ }).click();
  await page.getByRole('dialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
  await page.getByRole('link', { name: 'Editar', exact: true }).click();
  const name = page.getByLabel('Nome do serviço');
  await name.fill('Novo rascunho');
  const reads = state.sessionReads();
  await finishMutation(page, pending, { negocio: BUSINESS, publicacao: LIVE });
  await expect(page).toHaveURL(/\/painel\/servicos\/12\/editar$/);
  await expect(name).toHaveValue('Novo rascunho');
  await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeVisible();
  expect(state.sessionReads()).toBe(reads);
});

test('sair durante criação impede adoção e redirecionamento por uma resposta antiga', async ({ page }) => {
  const state = await setup(page, { creating: true });
  let pending;
  await page.route('**/criar-negocio', route => {
    if (route.request().method() !== 'POST') return route.continue();
    pending = route;
  });
  await page.route('**/cep/01001000', route => json(route, BUSINESS));
  await page.goto('/criar-negocio');
  await page.getByLabel('Nome do negócio').fill(BUSINESS.nome);
  await page.getByLabel('Unhas', { exact: true }).check();
  await page.getByLabel(/WhatsApp/).fill(BUSINESS.whatsapp);
  await page.getByLabel(/Link do Google Maps/).fill(BUSINESS.localizacao_url);
  await page.getByLabel(/CEP/).fill(BUSINESS.cep);
  await expect(page.getByLabel('Endereço', { exact: true })).toHaveValue(BUSINESS.endereco);
  await page.getByLabel('Número', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Criar negócio', exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const reads = state.sessionReads();
  state.setBusiness(BUSINESS);
  await finishMutation(page, pending, { negocio: BUSINESS }, 201);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Crie seu negócio' })).not.toBeVisible();
  expect(state.sessionReads()).toBe(reads);
});
