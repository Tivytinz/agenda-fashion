import { expect, test } from "@playwright/test";

const BUSINESS = {
  id: 11,
  slug: "studio-aurora",
  nome: "Studio Aurora",
  descricao: "Beleza com hora marcada",
  whatsapp: "11999999999",
  cidade: "São Paulo",
  estado: "SP",
  bairro: "Centro",
  endereco: "Rua das Flores",
  numero: "10",
  cep: "01001000",
  areas: ["Unhas"],
  papel: "dono",
  publicado: true
};

const SUGGESTED_WEEK = [
  {
    dia_semana: 0,
    trabalha: false,
    hora_inicio: null,
    hora_fim: null,
    intervalo_inicio: null,
    intervalo_fim: null
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    dia_semana: index + 1,
    trabalha: true,
    hora_inicio: "08:00",
    hora_fim: "18:00",
    intervalo_inicio: "12:00",
    intervalo_fim: "13:00"
  })),
  {
    dia_semana: 6,
    trabalha: true,
    hora_inicio: "08:00",
    hora_fim: "13:00",
    intervalo_inicio: null,
    intervalo_fim: null
  }
];

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

test("onboarding de horários confirma a sugestão e segue para divulgação no mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("usuario", JSON.stringify({ id: 4, nome: "Ana" }));
    localStorage.setItem("negocio", JSON.stringify({
      id: 11,
      nome: "Studio Aurora",
      papel: "dono"
    }));
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-09-10T00:00:00.000Z"
    }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 4, nome: "Ana", email: "ana@example.com" },
    negocio: BUSINESS,
    temNegocio: true,
    administrador: null,
    ehAdministrador: false
  }));
  await page.route("**/marketing/meta/config", (route) => json(route, {
    enabled: false,
    pixelId: null
  }));
  await page.route("**/marketing/google/config", (route) => json(route, {
    enabled: false,
    measurementId: null
  }));
  await page.route("**/configuracoes", (route) => json(route, {
    negocio: BUSINESS,
    publicacao: {
      publicado: true,
      pode_publicar: true,
      pendencias: []
    }
  }));

  let savedPayload = null;
  let scheduleSaved = false;
  await page.route("**/agenda-configuracao", async (route) => {
    if (route.request().method() === "PUT") {
      savedPayload = route.request().postDataJSON();
      scheduleSaved = true;
      return json(route, {
        mensagem: "Horários salvos.",
        configuracao: {
          configurado_em: "2026-09-10T05:00:00.000Z",
          origem_horarios: "personalizado"
        },
        horarios: SUGGESTED_WEEK,
        publicacao: null
      });
    }

    return json(route, {
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 24,
        configurado_em: scheduleSaved
          ? "2026-09-10T05:00:00.000Z"
          : "2026-09-10T04:00:00.000Z",
        origem_horarios: scheduleSaved ? "personalizado" : "padrao_af"
      },
      horarios: SUGGESTED_WEEK
    });
  });

  await page.goto("/painel/horarios?plano=autonoma");

  const confirm = page.getByRole("button", { name: "Confirmar horários" });
  const skip = page.getByRole("button", { name: "Pular por agora" });
  const adjust = page.getByRole("button", { name: "Ajustar horários" });

  await expect(page.getByRole("heading", { name: "Confirme quando você atende" }))
    .toBeVisible();
  await expect(confirm).toBeVisible();
  await expect(skip).toHaveCount(0);
  await expect(adjust).toBeVisible();

  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth === document.documentElement.clientWidth
  ))).toBe(true);

  await confirm.click();
  await expect(page).toHaveURL(
    /\/painel\/horarios\?(?=.*plano=autonoma)(?=.*onboarding=divulgacao)/
  );
  await expect(page.getByRole("heading", { name: "Agora divulgue seu perfil" }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Compartilhar perfil" }))
    .toBeVisible();
  await expect(page.getByRole("link", { name: "Concluir plano escolhido" }))
    .toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Agora divulgue seu perfil" }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Compartilhar perfil" }))
    .toBeVisible();

  expect(savedPayload?.horarios).toEqual(expect.arrayContaining([
    expect.objectContaining({
      diaSemana: 1,
      trabalha: true,
      horaInicio: "08:00",
      horaFim: "18:00",
      intervaloInicio: "12:00",
      intervaloFim: "13:00"
    }),
    expect.objectContaining({
      diaSemana: 6,
      trabalha: true,
      horaInicio: "08:00",
      horaFim: "13:00"
    })
  ]));
});
