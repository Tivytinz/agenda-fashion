import { expect, test } from '@playwright/test';

const BUSINESS = { id: 11, nome: 'Studio Aurora', slug: 'studio-aurora', papel: 'dono', publicado: true };
const CONFIG = {
  duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0,
  antecedencia_cancelamento: 2, configurado_em: '2026-10-10T00:00:00.000Z',
  origem_horarios: 'personalizado'
};
const week = open => Array.from({ length: 7 }, (_, dia_semana) => ({
  dia_semana, trabalha: open && dia_semana === 1, hora_inicio: '08:00', hora_fim: '18:00',
  intervalo_inicio: null, intervalo_fim: null
}));
const activation = available => ({
  negocio: BUSINESS,
  ativacao: { possui_disponibilidade_agendavel: available },
  proxima_acao_ativacao: { estado: 'CONQUISTAR_PRIMEIRO_AGENDAMENTO' }
});
const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(body)
});

async function setup(page, { open = true, holdSave = false } = {}) {
  const state = { initial: null, pendingSave: null, reads: 0, writes: [], settled: new Set() };
  page.on('requestfinished', request => state.settled.add(request));
  page.on('requestfailed', request => state.settled.add(request));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)
      ? route.abort('blockedbyclient') : route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('session_active', '1');
    localStorage.setItem('af_marketing_consent_v2', JSON.stringify({
      version: 2, status: 'denied', updatedAt: '2026-10-10T00:00:00.000Z'
    }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async value => { window.__copiedProfile = value; } }
    });
  });
  await page.route('**/minha-sessao', route => json(route, {
    usuario: { id: 4, nome: 'Ana', email: 'ana@example.com', perfil_profissional: true },
    negocio: BUSINESS, temNegocio: true, administrador: null, ehAdministrador: false
  }));
  for (const path of ['marketing/meta/config', 'marketing/google/config']) {
    await page.route(`**/${path}`, route => json(route, { enabled: false }));
  }
  for (const path of ['eventos-produto', 'analytics/collect', 'consentimento']) {
    await page.route(`**/${path}`, route => json(route, {}));
  }
  await page.route('**/agenda-configuracao', route => {
    if (route.request().method() === 'PUT') {
      state.writes.push(route.request().postDataJSON());
      if (holdSave) { state.pendingSave = route; return; }
      return json(route, { configuracao: CONFIG, mensagem: 'Horários salvos.' });
    }
    return json(route, { configuracao: CONFIG, horarios: week(open) });
  });
  await page.route('**/dashboard-dono/ativacao', route => {
    state.reads += 1;
    if (state.reads === 1) { state.initial = route; return; }
    return json(route, activation(true));
  });
  await page.goto('/painel/horarios?plano=autonoma&onboarding=divulgacao');
  await expect.poll(() => Boolean(state.initial)).toBe(true);
  return state;
}

async function releaseInitial(page, state, body) {
  await json(state.initial, body);
  // O request pode terminar com a resposta ou já ter sido cancelado pela edição.
  await expect.poll(() => state.settled.has(state.initial.request())).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('leitura atrasada mantém o rascunho acessível para continuar editando e salvar', async ({ page }) => {
  const state = await setup(page);
  const start = page.getByLabel('Início do atendimento de Segunda');
  await start.fill('09:00');
  await releaseInitial(page, state, activation(true));
  await expect(start).toHaveValue('09:00');
  await expect(page.getByRole('button', { name: 'Salvar horários', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);

  await page.getByRole('navigation', { name: 'Área de trabalho' })
    .getByRole('link', { name: /Serviços/ }).click();
  await page.getByRole('dialog', { name: 'Sair sem salvar?' })
    .getByRole('button', { name: 'Continuar editando' }).click();
  await expect(start).toHaveValue('09:00');
  await page.getByRole('button', { name: 'Salvar horários', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copiar link', exact: true })).toBeVisible();
  expect(state.writes[0].horarios.find(day => day.diaSemana === 1).horaInicio).toBe('09:00');
  expect(state.reads).toBe(2);
  await expect(page).toHaveURL(/plano=autonoma/);
});

test('resposta inicial antiga não remove o link confirmado depois de salvar', async ({ page }) => {
  const state = await setup(page, { open: false });
  await page.getByRole('checkbox', { name: /^Segunda/ }).check();
  await page.getByRole('button', { name: 'Salvar horários', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copiar link', exact: true })).toBeVisible();
  await releaseInitial(page, state, activation(false));

  await expect(page.getByRole('button', { name: 'Compartilhar perfil', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver perfil público/ }))
    .toHaveAttribute('href', '/negocio/studio-aurora');
  await page.getByRole('button', { name: 'Copiar link', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedProfile)).toContain('/negocio/studio-aurora');
  await expect(page.getByText(/não conseguimos carregar seu perfil/i)).toHaveCount(0);
  expect(state.reads).toBe(2);
  expect(state.writes).toHaveLength(1);
});

test('leitura inicial não abre divulgação enquanto o salvamento ainda está pendente', async ({ page }) => {
  const state = await setup(page, { holdSave: true });
  await page.getByRole('button', { name: 'Salvar horários', exact: true }).click();
  await expect.poll(() => Boolean(state.pendingSave)).toBe(true);
  await releaseInitial(page, state, activation(true));

  await expect(page.getByLabel('Início do atendimento de Segunda')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Compartilhar perfil', exact: true })).toHaveCount(0);
  expect(state.reads).toBe(1);
  await json(state.pendingSave, { configuracao: CONFIG, mensagem: 'Horários salvos.' });
  await expect(page.getByRole('button', { name: 'Compartilhar perfil', exact: true })).toBeVisible();
  expect(state.reads).toBe(2);
});
