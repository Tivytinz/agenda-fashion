// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes
} from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { useSession } from "../auth/SessionContext";
import {
  ConfirmPage,
  formatCancellationPolicy
} from "./ConfirmPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/track", () => ({
  track: vi.fn()
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: vi.fn()
}));

const BOOKING = {
  slug: "studio-aurora",
  business: { id: 7, nome: "Studio Aurora" },
  service: { id: 11, nome: "Manicure", valor: 50 },
  professional: { id: 21, nome: "Ana" },
  date: "2026-08-05",
  time: "09:00",
  hasProfessionalChoice: false
};

function isPolicyRequest(path) {
  return String(path).startsWith(
    "/agenda-publica/politica-cancelamento?"
  );
}

function mockPolicy(hours = 24) {
  apiRequest.mockImplementation((path) => {
    if (isPolicyRequest(path)) {
      return Promise.resolve({
        politica_cancelamento: {
          antecedencia_horas: hours
        }
      });
    }

    return Promise.resolve({});
  });
}

function renderConfirmation(booking = BOOKING) {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: "/confirmar",
      state: booking
    }]}>
      <Routes>
        <Route path="/confirmar" element={<ConfirmPage />} />
        <Route path="/sucesso" element={<h1>Agendamento confirmado</h1>} />
        <Route path="/negocio/:slug" element={<h1>Escolher horário</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillCustomer(user) {
  await user.type(screen.getByRole("textbox", { name: "Seu nome" }), "Victor Souza");
  await user.type(
    screen.getByRole("textbox", { name: "WhatsApp para confirmação" }),
    "62999998888"
  );
}

async function waitPolicy() {
  await screen.findByText(
    "Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência."
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  apiRequest.mockReset();
  track.mockReset();
  mockPolicy();
  useSession.mockReturnValue({
    authenticated: false,
    usuario: null
  });
});

afterEach(cleanup);

describe("formatCancellationPolicy", () => {
  it("explica zero, singular e plural sem inventar política inválida", () => {
    expect(formatCancellationPolicy(0)).toBe(
      "Você pode cancelar até antes do horário agendado."
    );
    expect(formatCancellationPolicy(1)).toBe(
      "Cancelamentos devem ser feitos com pelo menos 1 hora de antecedência."
    );
    expect(formatCancellationPolicy(24)).toBe(
      "Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência."
    );
    expect(formatCancellationPolicy(-1)).toBe("");
  });
});

describe("confirmação do agendamento", () => {
  it("mantém três etapas quando a profissional não precisou ser escolhida", () => {
    renderConfirmation();

    const progress = screen.getByRole("list", {
      name: "Etapas do agendamento"
    });
    const steps = progress.querySelectorAll("li");

    expect(steps).toHaveLength(3);
    expect(steps[0].textContent).toContain("Serviço");
    expect(steps[0].querySelector(".flow-confirmation-icon")).not.toBeNull();
    expect(steps[1].textContent).toContain("Horário");
    expect(steps[1].querySelector(".flow-confirmation-icon")).not.toBeNull();
    expect(steps[2].textContent).toContain("Confirmar");
    expect(steps[2].getAttribute("aria-current")).toBe("step");
  });

  it("mantém a etapa profissional quando houve escolha entre profissionais", () => {
    renderConfirmation({
      ...BOOKING,
      hasProfessionalChoice: true
    });

    const progress = screen.getByRole("list", {
      name: "Etapas do agendamento"
    });
    expect(progress.querySelectorAll("li")).toHaveLength(4);
    expect(progress.textContent).toContain("Profissional");
  });

  it("mostra a política vigente antes de liberar a confirmação", async () => {
    renderConfirmation();

    const button = screen.getByRole("button", {
      name: "Confirmar agendamento"
    });
    expect(button.disabled).toBe(true);

    await waitPolicy();
    expect(button.disabled).toBe(false);
  });

  it("mostra o exemplo e aplica a máscara do WhatsApp durante a digitação", async () => {
    const user = userEvent.setup();
    renderConfirmation();

    const input = screen.getByRole("textbox", {
      name: "WhatsApp para confirmação"
    });
    expect(input.getAttribute("placeholder")).toBe("(00) 12345-6789");

    await user.type(input, "62999998888");
    expect(input.value).toBe("(62) 99999-8888");
  });

  it("não herda a autorização da conta ao trocar o número do agendamento", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue({
      authenticated: true,
      usuario: {
        whatsapp:
          "62999998888",
        aceita_notificacoes_whatsapp:
          true
      }
    });

    renderConfirmation();

    expect(screen.getByText(
      /Você receberá confirmação/
    )).not.toBeNull();

    const input = screen.getByRole(
      "textbox",
      {
        name:
          "WhatsApp para confirmação"
      }
    );

    await user.clear(input);
    await user.type(
      input,
      "62911112222"
    );

    expect(screen.getByText(
      /diferente do WhatsApp autorizado/
    )).not.toBeNull();
  });

  it("envia a política exibida como expectativa e abre a tela de sucesso", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path) => {
      if (isPolicyRequest(path)) {
        return Promise.resolve({
          politica_cancelamento: {
            antecedencia_horas: 24
          }
        });
      }

      if (path === "/agendamentos") {
        return Promise.resolve({
          agendamento: {
            id: 90,
            data: BOOKING.date,
            horario: BOOKING.time,
            status: "agendado"
          }
        });
      }

      return Promise.resolve({});
    });
    sessionStorage.setItem("af_booking_draft", JSON.stringify(BOOKING));

    renderConfirmation();
    await waitPolicy();
    await fillCustomer(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", {
      name: "Confirmar agendamento"
    }));

    expect(apiRequest).toHaveBeenCalledWith("/agendamentos", {
      method: "POST",
      body: {
        slug: "studio-aurora",
        servico_id: 11,
        profissional_id: 21,
        data: "2026-08-05",
        horario: "09:00",
        cliente_nome: "Victor Souza",
        cliente_whatsapp: "62999998888",
        antecedencia_cancelamento_esperada: 24,
        aceita_mensagens_whatsapp: true
      }
    });

    expect(track).toHaveBeenCalledWith(
      "agendamento_concluido",
      expect.objectContaining({
        businessId: 7,
        properties: expect.objectContaining({
          agendamento_id: 90,
          servico_id: 11,
          status: "sucesso"
        })
      })
    );

    expect(await screen.findByRole("heading", {
      name: "Agendamento confirmado"
    })).not.toBeNull();
    expect(sessionStorage.getItem("af_booking_draft")).toBeNull();
  });

  it("informa conflito e permite voltar para escolher outro horário", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path) => {
      if (isPolicyRequest(path)) {
        return Promise.resolve({
          politica_cancelamento: {
            antecedencia_horas: 24
          }
        });
      }

      return Promise.reject(Object.assign(
        new Error("Conflito"),
        { status: 409 }
      ));
    });

    renderConfirmation();
    await waitPolicy();
    await fillCustomer(user);
    await user.click(screen.getByRole("button", {
      name: "Confirmar agendamento"
    }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Esse horário acabou de ser reservado"
    );
    await user.click(screen.getByRole("button", {
      name: "Escolher outro horário"
    }));
    expect(screen.getByRole("heading", {
      name: "Escolher horário"
    })).not.toBeNull();
  });

  it("recarrega e reapresenta a regra quando a política mudou", async () => {
    const user = userEvent.setup();
    let policyCalls = 0;

    apiRequest.mockImplementation((path) => {
      if (isPolicyRequest(path)) {
        policyCalls += 1;
        return Promise.resolve({
          politica_cancelamento: {
            antecedencia_horas: policyCalls === 1 ? 24 : 2
          }
        });
      }

      return Promise.reject(Object.assign(
        new Error(
          "A política de cancelamento foi atualizada. Revise as condições antes de confirmar o agendamento."
        ),
        { status: 409 }
      ));
    });

    renderConfirmation();
    await waitPolicy();
    await fillCustomer(user);
    await user.click(screen.getByRole("button", {
      name: "Confirmar agendamento"
    }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "A política de cancelamento mudou"
    );
    expect(await screen.findByText(
      "Cancelamentos devem ser feitos com pelo menos 2 horas de antecedência."
    )).not.toBeNull();
  });

  it("não envia duas vezes enquanto a primeira confirmação está em andamento", async () => {
    const user = userEvent.setup();
    let finishRequest;
    apiRequest.mockImplementation((path) => {
      if (isPolicyRequest(path)) {
        return Promise.resolve({
          politica_cancelamento: {
            antecedencia_horas: 24
          }
        });
      }

      if (path === "/agendamentos") {
        return new Promise((resolve) => {
          finishRequest = resolve;
        });
      }

      return Promise.resolve({});
    });

    renderConfirmation();
    await waitPolicy();
    await fillCustomer(user);

    const form = screen.getByRole("button", {
      name: "Confirmar agendamento"
    }).closest("form");

    fireEvent.submit(form);
    fireEvent.submit(form);

    const postCalls = apiRequest.mock.calls.filter(
      ([path]) => path === "/agendamentos"
    );
    expect(postCalls).toHaveLength(1);

    finishRequest({
      agendamento: {
        id: 91,
        data: BOOKING.date,
        horario: BOOKING.time,
        status: "agendado"
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", {
        name: "Agendamento confirmado"
      })).not.toBeNull();
    });
  });
});
