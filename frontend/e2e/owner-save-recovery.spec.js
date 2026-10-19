import { expect, test } from '@playwright/test';

const BUSINESS = {
  id: 11, slug: 'studio-aurora', nome: 'Studio Aurora', descricao: '',
  whatsapp: '11999999999', cidade: 'São Paulo', estado: 'SP', bairro: 'Centro',
  endereco: 'Rua das Flores', numero: '10', cep: '01001000', areas: ['Unhas'],
  localizacao_url: 'https://maps.google.com/?q=studio', papel: 'dono', publicado: true
};
const SERVICE = { id: 12, nome: 'Manicure', categoria: 'unha', valor: 50, duracao_minutos: 60, ativo: true };
const CONFIG = { duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0,
  antecedencia_cancelamento: 2, origem_horarios: 'personalizado', configurado_em: '2026-10-10T00:00:00.000Z' };
const WEEK = [{ dia_semana: 1, trabalha: true, hora_inicio: '08:00', hora_fim: '18:00', intervalo_inicio: null, intervalo_fim: null }];
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

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
  await page.route('**/servicos', route => json(route, { servicos: [SERVICE] }));
  await page.route('**/minha-assinatura', route => json(route, {}));
  await page.route('**/configuracoes', route => json(route, {
    negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true, pendencias: [] }
  }));
}

test('salvamento do negócio bloqueia novas edições e protege a edição seguinte', async ({ page }) => {
  await setup(page);
  let pending;
  await page.route('**/configuracoes', route => {
    if (route.request().method() === 'PUT') { pending = route; return; }
    return json(route, { negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } });
  });
  await page.goto('/painel/negocio');
  const name = page.getByLabel('Nome do negócio');
  await name.fill('Nome enviado');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(name).toBeDisabled();
  await expect(page.getByLabel('Descrição (opcional)')).toBeDisabled();
  await expect(page.getByLabel('Estado', { exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox').first()).toBeDisabled();
  const first = pending;
  await json(first, { negocio: { ...BUSINESS, ...first.request().postDataJSON() }, mensagem: 'Alterações salvas.' });
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue('Nome enviado');

  await name.fill('Nova edição após salvar');
  const services = page.getByRole('navigation', { name: 'Área de trabalho' }).getByRole('link', { name: /Serviços/ });
  await services.click();
  const dialog = page.getByRole('dialog', { name: 'Sair sem salvar?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(name).toHaveValue('Nova edição após salvar');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => pending !== first).toBe(true);
  const second = pending;
  expect(second.request().postDataJSON().nome).toBe('Nova edição após salvar');
  await json(second, { negocio: { ...BUSINESS, ...second.request().postDataJSON() } });
  await expect(name).toBeEnabled();
  await services.click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  await expect(dialog).not.toBeVisible();
});

test('falha ao salvar horários libera os campos e preserva a regra para nova tentativa', async ({ page }) => {
  await setup(page);
  let pending;
  await page.route('**/agenda-configuracao', route => {
    if (route.request().method() === 'PUT') { pending = route; return; }
    return json(route, { configuracao: CONFIG, horarios: WEEK });
  });
  await page.goto('/painel/horarios');
  const lead = page.getByLabel('Antecedência para cancelar');
  await lead.fill('4');
  await page.getByRole('button', { name: 'Salvar horários' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(lead).toBeDisabled();
  await expect(page.getByLabel('Início do atendimento de Segunda')).toBeDisabled();
  await expect(page.getByRole('checkbox').first()).toBeDisabled();
  const first = pending;
  await json(first, { mensagem: 'Falha temporária no salvamento' }, 503);
  await expect(page.getByRole('alert')).toContainText('Falha temporária no salvamento');
  await expect(lead).toBeEnabled();
  await expect(lead).toHaveValue('4');
  await lead.fill('6');
  await page.getByRole('button', { name: 'Salvar horários' }).click();
  await expect.poll(() => pending !== first).toBe(true);
  const second = pending;
  expect(second.request().postDataJSON().antecedenciaCancelamento).toBe(6);
  await json(second, { configuracao: CONFIG, horarios: second.request().postDataJSON().horarios });
  await expect(lead).toBeEnabled();
  await expect(lead).toHaveValue('6');
  await page.getByRole('navigation', { name: 'Área de trabalho' }).getByRole('link', { name: /Serviços/ }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeVisible();
});

test('falha na galeria mantém o serviço preenchido e a tentativa preserva a edição', async ({ page }) => {
  await setup(page);
  let galleryAttempts = 0;
  let serviceLoads = 0;
  let galleryAvailable = false;
  await page.route('**/servicos', route => { serviceLoads += 1; return json(route, { servicos: [SERVICE] }); });
  await page.route('**/servicos/12/fotos', route => {
    galleryAttempts += 1;
    return !galleryAvailable
      ? json(route, { mensagem: 'Falha temporária nas fotos' }, 503)
      : json(route, [{ id: 31, foto_url: 'https://img.example/foto.png' }]);
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByRole('alert')).toContainText('Falha temporária nas fotos');
  const name = page.getByLabel('Nome do serviço');
  await expect(name).toHaveValue('Manicure');
  await expect(page.getByRole('spinbutton', { name: 'Valor' })).toHaveValue('50');
  await name.fill('Manicure completa');
  const initialServiceLoads = serviceLoads;
  const initialGalleryAttempts = galleryAttempts;
  galleryAvailable = true;
  await page.getByRole('button', { name: 'Tentar carregar fotos novamente' }).click();
  await expect(page.getByRole('button', { name: 'Remover foto da galeria' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(name).toHaveValue('Manicure completa');
  expect(serviceLoads).toBe(initialServiceLoads);
  expect(galleryAttempts).toBe(initialGalleryAttempts + 1);
});

test('upload bloqueia a troca de capa e uma falha permite escolher e enviar outra', async ({ page }) => {
  await setup(page);
  let pending;
  let uploadCount = 0;
  await page.route('**/servicos/12/fotos', route => json(route, []));
  await page.route('**/servicos/12', route => json(route, { servico: SERVICE }));
  await page.route('**/servicos/12/foto', route => { uploadCount += 1; pending = route; });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByLabel('Nome do serviço')).toHaveValue('Manicure');
  const cover = page.locator('.cover-upload input[type=file]');
  const gallery = page.getByLabel('Adicionar fotos à galeria');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=', 'base64');
  await cover.setInputFiles({ name: 'primeira.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(cover).toBeDisabled();
  await expect(gallery).toBeDisabled();
  await expect(page.getByLabel('Nome do serviço')).toBeDisabled();
  const first = pending;
  expect(first.request().postDataBuffer().toString()).toContain('primeira.png');
  await json(first, { mensagem: 'Upload indisponível' }, 503);
  await expect(page.getByRole('alert')).toContainText('O serviço foi salvo, mas algumas fotos não foram enviadas.');
  await expect(cover).toBeEnabled();
  await expect(page.getByAltText('Prévia da nova capa')).toBeVisible();
  await cover.setInputFiles({ name: 'nova-escolha.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect.poll(() => pending !== first).toBe(true);
  const second = pending;
  expect(second.request().postDataBuffer().toString()).toContain('nova-escolha.png');
  await json(second, { foto_url: 'https://img.example/nova-escolha.png' });
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  expect(uploadCount).toBe(2);
  await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeVisible();
});

test('dados do serviço podem ser editados enquanto as fotos ainda carregam', async ({ page }) => {
  await setup(page);
  let galleryRequest;
  await page.route('**/servicos/12/fotos', route => { galleryRequest = route; });
  await page.goto('/painel/servicos/12/editar');
  const name = page.getByLabel('Nome do serviço');
  await expect(name).toHaveValue('Manicure');
  await expect(page.getByText('Carregando fotos...')).toBeVisible();
  await name.fill('Manicure completa');
  await expect.poll(() => Boolean(galleryRequest)).toBe(true);
  await json(galleryRequest, [{ id: 31, foto_url: 'https://img.example/foto.png' }]);
  await expect(page.getByRole('button', { name: 'Remover foto da galeria' })).toBeVisible();
  await expect(name).toHaveValue('Manicure completa');
});

test('troca da agenda da equipe para a dona aguarda a leitura e permite repetir uma falha', async ({ page }) => {
  await setup(page);
  let pending;
  let ownAvailable = false;
  let submitted;
  await page.route(/\/agenda-configuracao(?:\?.*)?$/, route => {
    if (route.request().method() === 'PUT') {
      submitted = route.request().postDataJSON();
      return json(route, { configuracao: CONFIG, horarios: submitted.horarios });
    }
    if (route.request().url().includes('profissionalId=22')) {
      return json(route, {
        configuracao: CONFIG,
        horarios: [{ ...WEEK[0], hora_inicio: '14:00' }],
        profissional: { id: 22, nome: 'Alice' }
      });
    }
    if (ownAvailable) return json(route, { configuracao: CONFIG, horarios: WEEK });
    pending = route;
  });
  await page.goto('/painel/horarios?profissional=22');
  await expect(page.getByLabel('Início do atendimento de Segunda')).toHaveValue('14:00');
  await page.getByRole('navigation', { name: 'Área de trabalho' }).getByRole('link', { name: 'Horários', exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/horarios$/);
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(page.getByText('Carregando horários...')).toBeVisible();
  await expect(page.getByLabel('Início do atendimento de Segunda')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar horários' })).toHaveCount(0);
  expect(submitted).toBeUndefined();
  await json(pending, { mensagem: 'Agenda da dona indisponível' }, 503);
  await expect(page.getByRole('alert')).toContainText('Agenda da dona indisponível');
  await expect(page.getByLabel('Início do atendimento de Segunda')).toHaveCount(0);
  ownAvailable = true;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByLabel('Início do atendimento de Segunda')).toHaveValue('08:00');
  await page.getByRole('button', { name: 'Salvar horários' }).click();
  await expect.poll(() => Boolean(submitted)).toBe(true);
  expect(submitted.profissionalId).toBeUndefined();
  expect(submitted.horarios[0].horaInicio).toBe('08:00');
  await expect(page.getByRole('button', { name: 'Salvar horários' })).toBeEnabled();
});

test('CEP lento preserva o endereço e o bairro preenchidos manualmente até o salvamento', async ({ page }) => {
  await setup(page);
  let pending;
  let submitted;
  await page.route('**/cep/74000123', route => { pending = route; });
  await page.route('**/configuracoes', route => {
    if (route.request().method() === 'PUT') submitted = route.request().postDataJSON();
    return json(route, { negocio: { ...BUSINESS, ...submitted }, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } });
  });
  await page.goto('/painel/negocio');
  await expect(page.getByLabel('Nome do negócio')).toHaveValue('Studio Aurora');
  await page.getByLabel(/^CEP/).fill('74000123');
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByLabel('Endereço', { exact: true }).fill('Rua informada pela dona');
  await page.getByLabel('Bairro', { exact: true }).fill('Bairro informado pela dona');
  await json(pending, { endereco: 'Rua do CEP', bairro: 'Bairro do CEP', cidade: 'Goiânia', estado: 'GO' });
  await expect(page.getByLabel('Endereço', { exact: true })).toHaveValue('Rua informada pela dona');
  await expect(page.getByLabel('Bairro', { exact: true })).toHaveValue('Bairro informado pela dona');
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Goiânia');
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('GO');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => Boolean(submitted)).toBe(true);
  expect(submitted.endereco).toBe('Rua informada pela dona');
  expect(submitted.bairro).toBe('Bairro informado pela dona');
  expect(submitted.cidade).toBe('Goiânia');
  expect(submitted.estado).toBe('GO');
  await expect(page.getByText('Alterações salvas.', { exact: true })).toBeVisible();
});

test('upload parcial mostra as imagens salvas e repete somente a foto pendente', async ({ page }) => {
  await setup(page);
  const oldCover = { foto_url: 'https://img.example/antiga.png', foto_public_id: 'old' };
  const newCover = { foto_url: 'https://img.example/nova.png', foto_public_id: 'new' };
  let coverUploads = 0;
  let failed = false;
  const uploads = [];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=', 'base64');
  await page.route('https://img.example/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.route('**/servicos', route => json(route, { servicos: [{ ...SERVICE, ...oldCover }] }));
  await page.route('**/servicos/12', route => json(route, { servico: SERVICE }));
  await page.route('**/servicos/12/foto', route => {
    coverUploads += 1;
    return json(route, { servico: { ...SERVICE, ...newCover } });
  });
  await page.route('**/servicos/12/fotos', route => {
    if (route.request().method() !== 'POST') return json(route, { fotos: [{ id: 31, ...oldCover }] });
    const filename = route.request().postDataBuffer().toString().includes('salva.png') ? 'salva.png' : 'pendente.png';
    uploads.push(filename);
    if (filename === 'pendente.png' && !failed) {
      failed = true;
      return json(route, { mensagem: 'Galeria temporariamente indisponível' }, 503);
    }
    return json(route, { foto: { id: filename === 'salva.png' ? 32 : 33, foto_url: `https://img.example/${filename}` } });
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByRole('button', { name: 'Remover foto da galeria' })).toBeVisible();
  await page.locator('.cover-upload input[type=file]').setInputFiles({ name: 'capa.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Adicionar fotos à galeria').setInputFiles([
    { name: 'salva.png', mimeType: 'image/png', buffer: png },
    { name: 'pendente.png', mimeType: 'image/png', buffer: png }
  ]);
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page.getByRole('alert')).toContainText('algumas fotos não foram enviadas');
  await expect(page.locator('.cover-preview img')).toHaveAttribute('src', newCover.foto_url);
  await expect(page.locator('.service-gallery-picker img[src="https://img.example/salva.png"]')).toBeVisible();
  await expect(page.getByText('1 foto selecionada.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  expect(coverUploads).toBe(1);
  expect(uploads).toEqual(['salva.png', 'pendente.png', 'pendente.png']);
  await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeVisible();
});

async function delayedBusinessDestination(page) {
  let pendingModule;
  await page.route('**/src/pages/BusinessPage.jsx*', route => { pendingModule = route; });
  return {
    async leave() {
      const navigation = page.getByRole('navigation', { name: 'Área de trabalho' });
      await navigation.getByRole('button', { name: 'Abrir mais opções da área de trabalho' }).click();
      await navigation.getByRole('link', { name: 'Meu negócio', exact: true }).click();
      await page.getByRole('dialog', { name: 'Sair sem salvar?' })
        .getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
      await expect.poll(() => Boolean(pendingModule)).toBe(true);
      await expect(page).toHaveURL(/\/painel\/negocio$/);
    },
    async release() { await pendingModule?.continue(); }
  };
}

async function finishPendingWrite(page, route, body) {
  const finished = page.waitForEvent('requestfinished', request => request === route.request());
  await json(route, body);
  await finished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('sair durante upload não envia as próximas fotos enquanto Meu negócio carrega', async ({ page }) => {
  await setup(page);
  const destination = await delayedBusinessDestination(page);
  let pending;
  let uploads = 0;
  await page.route('**/servicos/12', route => json(route, { servico: SERVICE }));
  await page.route('**/servicos/12/fotos', route => {
    if (route.request().method() !== 'POST') return json(route, []);
    uploads += 1;
    if (uploads === 1) { pending = route; return; }
    return json(route, { foto: { id: 32 } });
  });
  await page.goto('/painel/servicos/12/editar');
  await expect(page.getByLabel('Nome do serviço')).toHaveValue('Manicure');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Adicionar fotos à galeria').setInputFiles([
    { name: 'primeira.png', mimeType: 'image/png', buffer: png },
    { name: 'segunda.png', mimeType: 'image/png', buffer: png }
  ]);
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  try {
    await destination.leave();
    await finishPendingWrite(page, pending, { foto: { id: 31 } });
    expect(uploads).toBe(1);
    await expect(page).toHaveURL(/\/painel\/negocio$/);
  } finally {
    await destination.release();
  }
  await expect(page.getByLabel('Nome do negócio')).toHaveValue(BUSINESS.nome);
  expect(uploads).toBe(1);
});

test('sair durante salvamento de horários não retoma ativação enquanto Meu negócio carrega', async ({ page }) => {
  await setup(page);
  const destination = await delayedBusinessDestination(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let pending;
  let activationReads = 0;
  await page.route('**/agenda-configuracao', route => {
    if (route.request().method() === 'PUT') { pending = route; return; }
    return json(route, { configuracao: { ...CONFIG, origem_horarios: 'padrao_af' }, horarios: WEEK });
  });
  await page.route('**/dashboard-dono/ativacao', route => {
    activationReads += 1;
    return json(route, {
      negocio: BUSINESS, ativacao: { possui_disponibilidade_agendavel: true },
      proxima_acao_ativacao: { estado: 'CONQUISTAR_PRIMEIRO_AGENDAMENTO' }
    });
  });
  await page.goto('/painel/horarios');
  await page.getByRole('button', { name: 'Ajustar horários' }).click();
  await page.getByLabel('Início do atendimento de Segunda').fill('09:00');
  await page.getByRole('button', { name: 'Salvar horários e continuar' }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  try {
    await destination.leave();
    await finishPendingWrite(page, pending, { configuracao: CONFIG });
    expect(activationReads).toBe(0);
    await expect(page).toHaveURL(/\/painel\/negocio$/);
    expect(errors).toEqual([]);
  } finally {
    await destination.release();
  }
  await expect(page.getByLabel('Nome do negócio')).toHaveValue(BUSINESS.nome);
  expect(activationReads).toBe(0);
  expect(errors).toEqual([]);
});
