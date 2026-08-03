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
import { ConfirmPage } from "./ConfirmPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/track", () => ({
  track: vi.fn()
}));

const BOOKING = {
  slug: "studio-aurora",
  business: { id: 7, nome: "Studio Aurora" },
  service: { id: 11, nome: "Manicure", valor: 50 },
  professional: { id: 21, nome: "Ana" },
  date: "2026-08-05",
  time: "09:00"
};

function renderConfirmation() {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: "/confirmar",
      state: BOOKING
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
  await user.type(screen.getByRole("textbox", { name: "Seu WhatsApp" }), "62999998888");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  apiRequest.mockReset();
});

afterEach(cleanup);

describe("confirmação do agendamento", () => {
  it("envia os dados normalizados e abre a tela de sucesso", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({
      agendamento: {
        id: 90,
        data: BOOKING.date,
        horario: BOOKING.time,
        status: "agendado"
      }
    });
    sessionStorage.setItem("af_booking_draft", JSON.stringify(BOOKING));

    renderConfirmation();
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
        aceita_mensagens_whatsapp: true
      }
    });
    expect(await screen.findByRole("heading", {
      name: "Agendamento confirmado"
    })).not.toBeNull();
    expect(sessionStorage.getItem("af_booking_draft")).toBeNull();
  });

  it("informa conflito e permite voltar para escolher outro horário", async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(Object.assign(
      new Error("Conflito"),
      { status: 409 }
    ));

    renderConfirmation();
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

  it("não envia duas vezes enquanto a primeira confirmação está em andamento", async () => {
    const user = userEvent.setup();
    let finishRequest;
    apiRequest.mockImplementation(() => new Promise((resolve) => {
      finishRequest = resolve;
    }));

    renderConfirmation();
    await fillCustomer(user);

    const form = screen.getByRole("button", {
      name: "Confirmar agendamento"
    }).closest("form");

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(apiRequest).toHaveBeenCalledTimes(1);

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
