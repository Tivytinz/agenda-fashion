import {
  expect,
  test,
} from "@playwright/test";

function luminancia([r, g, b]) {
  const canais = [
    r,
    g,
    b,
  ].map((valor) => {
    const normalizado =
      valor / 255;

    return normalizado <=
      0.03928
      ? normalizado / 12.92
      : Math.pow(
          (
            normalizado +
            0.055
          ) / 1.055,
          2.4
        );
  });

  return (
    0.2126 * canais[0] +
    0.7152 * canais[1] +
    0.0722 * canais[2]
  );
}

function extrairRgb(valor) {
  const numeros =
    String(valor)
      .match(/[0-9.]+/g)
      ?.slice(0, 3)
      .map(Number);

  if (
    !numeros ||
    numeros.length !== 3
  ) {
    throw new Error(
      `Cor CSS inválida: ${valor}`
    );
  }

  return numeros;
}

function contraste(
  frente,
  fundo
) {
  const a =
    luminancia(
      extrairRgb(frente)
    );
  const b =
    luminancia(
      extrairRgb(fundo)
    );
  const maior =
    Math.max(a, b);
  const menor =
    Math.min(a, b);

  return (
    (maior + 0.05) /
    (menor + 0.05)
  );
}

async function focarPorTeclado(
  page,
  locator
) {
  for (
    let tentativa = 0;
    tentativa < 30;
    tentativa += 1
  ) {
    await page.keyboard.press(
      "Tab"
    );

    if (
      await locator.evaluate(
        (elemento) =>
          elemento ===
          document.activeElement
      )
    ) {
      return;
    }
  }

  throw new Error(
    "Controle não recebeu foco pelo teclado."
  );
}

test(
  "CA-NFR-06: autenticação expõe rótulos, foco, contraste e erro acessível",
  async ({ page }) => {
    await page.route(
      "**/minha-sessao",
      (route) =>
        route.fulfill({
          status: 401,
          contentType:
            "application/json",
          body:
            JSON.stringify({
              erro:
                "Não autenticado",
            }),
        })
    );

    await page.route(
      "**/marketing/**",
      (route) =>
        route.fulfill({
          status: 200,
          contentType:
            "application/json",
          body:
            JSON.stringify({
              enabled: false,
            }),
        })
    );

    await page.goto(
      "/cadastro"
    );

    const nome =
      page.getByLabel(
        "Nome completo"
      );
    const email =
      page.getByLabel(
        "E-mail"
      );
    const senha =
      page.getByLabel(
        "Senha",
        {
          exact: true,
        }
      );
    const confirmarSenha =
      page.getByLabel(
        "Confirme a senha"
      );
    const criarConta =
      page.getByRole(
        "button",
        {
          name:
            "Criar conta",
        }
      );

    await expect(
      nome
    ).toBeVisible();
    await expect(
      email
    ).toBeVisible();
    await expect(
      senha
    ).toBeVisible();
    await expect(
      confirmarSenha
    ).toBeVisible();

    await focarPorTeclado(
      page,
      nome
    );
    await expect(
      nome
    ).toBeFocused();

    const indicadorFoco =
      await nome.evaluate(
        (elemento) => {
          const estilo =
            getComputedStyle(
              elemento
            );

          return (
            estilo.outlineStyle !==
              "none" &&
            parseFloat(
              estilo.outlineWidth
            ) > 0
          ) ||
            estilo.boxShadow !==
              "none";
        }
      );

    expect(
      indicadorFoco
    ).toBe(true);

    const cores =
      await criarConta.evaluate(
        (elemento) => {
          const estilo =
            getComputedStyle(
              elemento
            );

          return {
            color:
              estilo.color,
            background:
              estilo.backgroundColor,
          };
        }
      );

    expect(
      contraste(
        cores.color,
        cores.background
      )
    ).toBeGreaterThanOrEqual(
      4.5
    );

    await nome.fill(
      "Cliente Teste"
    );
    await email.fill(
      "cliente@example.com"
    );
    await page
      .getByLabel(
        "WhatsApp com DDD"
      )
      .fill(
        "62999999999"
      );
    await senha.fill(
      "senha-teste-123"
    );
    await confirmarSenha.fill(
      "senha-diferente"
    );
    await criarConta.click();

    await expect(
      page.getByRole(
        "alert"
      )
    ).toHaveText(
      "As senhas precisam ser iguais."
    );
  }
);
