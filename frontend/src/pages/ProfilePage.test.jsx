// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation
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
import { ProfilePage } from "./ProfilePage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/track", () => ({
  track: vi.fn()
}));

const PROFILE = {
  negocio: {
    id: 7,
    nome: "Studio Aurora",
    descricao: "Beleza com hora marcada",
    bairro: "Centro",
    cidade: "Sao Paulo",
    estado: "SP",
    latitude: -23.5505,
    longitude: -46.6333
  },
  servicos: [
    {
      id: 11,
      nome: "Manicure completa",
      descricao: "Cuidado completo para as unhas",
      duracao_minutos: 60,
      valor: 50
    },
    {
      id: 12,
      nome: "Pedicure",
      duracao_minutos: 45,
      valor: 45
    }
  ],
  profissionais: [
    { id: 21, nome: "Ana" },
    { id: 22, nome: "Beatriz" }
  ]
};

const AVAILABILITY = {
  disponibilidade: [
    { data: "2026-08-05", horarios: ["09:00", "10:30"] },
    { data: "2026-08-06", horarios: ["14:00"] }
  ]
};

function ConfirmationProbe() {
  const location = useLocation();
  const booking = location.state;

  return (
    <div>
      <h1>Confirmacao</h1>
      <span>{booking?.service?.nome}</span>
      <span>{booking?.professional?.nome}</span>
      <span>{booking?.date}</span>
      <span>{booking?.time}</span>
    </div>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="localização atual">{`${location.pathname}${location.search}`}</output>;
}

function renderProfile(initialEntry = "/negocio/studio-aurora") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/negocio/:slug" element={<ProfilePage />} />
        <Route path="/confirmar" element={<ConfirmationProbe />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

function mockSuccessfulRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/perfil-negocio/")) {
      return Promise.resolve(PROFILE);
    }

    if (path.startsWith("/agenda-publica?")) {
      return Promise.resolve(AVAILABILITY);
    }

    return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  apiRequest.mockReset();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn()
    }
  });
});

afterEach(cleanup);

describe("fluxo publico de agendamento", () => {
  it("leva um endereço antigo ao endereço público atual sem perder parâmetros", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/perfil-negocio/victor") {
        return Promise.resolve({
          ...PROFILE,
          redirecionamento: {
            slug: "beauty-vanessa"
          }
        });
      }

      if (path === "/perfil-negocio/beauty-vanessa") {
        return Promise.resolve({
          ...PROFILE,
          negocio: {
            ...PROFILE.negocio,
            slug: "beauty-vanessa"
          },
          redirecionamento: null
        });
      }

      return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
    });

    renderProfile("/negocio/victor?servico=11");

    await waitFor(() => {
      expect(screen.getByLabelText("localização atual").textContent)
        .toBe("/negocio/beauty-vanessa?servico=11");
    });

    expect(await screen.findByRole("heading", { name: "Studio Aurora" }))
      .not.toBeNull();
  });

  it("oculta o resumo até a cliente escolher um serviço", async () => {
    const user = userEvent.setup();
    mockSuccessfulRequests();
    renderProfile();

    await screen.findByRole("heading", { name: "Studio Aurora" });
    expect(screen.queryByRole("heading", { name: "Resumo" })).toBeNull();

    await user.click(screen.getByRole("button", {
      name: "Selecionar Manicure completa"
    }));

    expect(screen.getByRole("heading", { name: "Resumo" })).not.toBeNull();
  });

  it("usa a primeira foto de serviço quando o negócio não possui foto", async () => {
    const profileWithServicePhoto = {
      ...PROFILE,
      servicos: PROFILE.servicos.map((service, index) => (
        index === 0
          ? { ...service, foto_url: "/uploads/manicure.jpg" }
          : service
      ))
    };

    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/perfil-negocio/")) {
        return Promise.resolve(profileWithServicePhoto);
      }
      return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
    });

    renderProfile();

    const image = await screen.findByRole("img", {
      name: "Foto de Studio Aurora"
    });
    expect(image.getAttribute("src")).toContain("/uploads/manicure.jpg");
  });

  it("mostra a falha ao favoritar perto da ação", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "token-valido");
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith("/perfil-negocio/")) return Promise.resolve(PROFILE);
      if (path === "/favoritos/7/status") return Promise.resolve({ favoritado: false });
      if (path === "/favoritos/7" && options?.method === "POST") {
        return Promise.reject(new Error("Não foi possível salvar o favorito"));
      }
      return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
    });

    renderProfile();
    await user.click(await screen.findByRole("button", { name: /Favoritar/ }));

    expect((await screen.findByRole("alert")).textContent)
      .toContain("Não foi possível salvar o favorito");
    expect(screen.getByRole("button", { name: /Favoritar/ }).disabled).toBe(false);
  });

  it("personaliza o titulo com o nome do negocio", async () => {
    mockSuccessfulRequests();
    renderProfile();

    await screen.findByRole("heading", { name: "Studio Aurora" });

    await waitFor(() => {
      expect(document.title).toBe("Studio Aurora | Agenda Fashion");
    });
  });

  it("seleciona servico, profissional e horario antes de revisar", async () => {
    const user = userEvent.setup();
    mockSuccessfulRequests();
    renderProfile();

    await screen.findByRole("heading", { name: "Studio Aurora" });
    expect(document.querySelectorAll(".flow-steps li")).toHaveLength(4);
    expect(document.querySelector(".flow-steps")?.textContent).not.toContain("✓");

    await user.click(await screen.findByRole("button", {
      name: "Selecionar Manicure completa"
    }));
    await user.click(screen.getByRole("button", { name: /Ana/ }));

    expect(await screen.findByRole("button", { name: "09:00" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Ver datas anteriores" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Ver próximas datas" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Selecione um horário" }).disabled)
      .toBe(true);

    await user.click(screen.getByRole("button", { name: "09:00" }));

    expect(screen.getByText("Manicure completa", { selector: "dd" }))
      .not.toBeNull();
    expect(screen.getByText("Ana", { selector: "dd" })).not.toBeNull();
    expect(screen.getByText("09:00", { selector: "dd" })).not.toBeNull();

    await user.click(screen.getByRole("button", {
      name: "Revisar e confirmar"
    }));

    expect(screen.getByRole("heading", { name: "Confirmacao" }))
      .not.toBeNull();
    expect(screen.getByText("2026-08-05")).not.toBeNull();
    expect(screen.queryByText("10:30")).toBeNull();

    const draft = JSON.parse(sessionStorage.getItem("af_booking_draft"));
    expect(draft).toMatchObject({
      slug: "studio-aurora",
      service: { id: 11 },
      professional: { id: 21 },
      date: "2026-08-05",
      time: "09:00"
    });

    expect(apiRequest.mock.calls.filter(([path]) => (
      path.startsWith("/perfil-negocio/")
    ))).toHaveLength(1);
  });

  it("remove a escolha de profissional quando existe apenas uma opção", async () => {
    const user = userEvent.setup();
    const singleProfessionalProfile = {
      ...PROFILE,
      negocio: {
        ...PROFILE.negocio,
        areas: ["Sobrancelhas", "Estética"]
      },
      profissionais: [{ id: 21, nome: "Ana" }]
    };

    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/perfil-negocio/")) {
        return Promise.resolve(singleProfessionalProfile);
      }
      if (path.startsWith("/agenda-publica?")) {
        return Promise.resolve(AVAILABILITY);
      }
      return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
    });

    renderProfile();
    await screen.findByRole("heading", { name: "Studio Aurora" });

    expect(screen.queryByRole("heading", {
      name: "Escolha quem vai atender"
    })).toBeNull();
    expect(document.querySelectorAll(".flow-steps li")).toHaveLength(3);
    expect(screen.getAllByText("Sobrancelhas").length).toBeGreaterThan(0);
    expect(screen.getByText("Estética")).not.toBeNull();

    await user.click(screen.getByRole("button", {
      name: "Selecionar Manicure completa"
    }));

    expect(await screen.findByRole("button", { name: "09:00" })).not.toBeNull();
    expect(screen.queryByRole("heading", {
      name: "Escolha quem vai atender"
    })).toBeNull();
    expect(screen.getByText("Etapa 2 de 3")).not.toBeNull();
  });

  it("limpa profissional e horario ao trocar o servico", async () => {
    const user = userEvent.setup();
    mockSuccessfulRequests();
    renderProfile();

    await user.click(await screen.findByRole("button", {
      name: "Selecionar Manicure completa"
    }));
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    await user.click(await screen.findByRole("button", { name: "09:00" }));

    expect(screen.getByRole("button", { name: "Revisar e confirmar" }).disabled)
      .toBe(false);

    await user.click(screen.getAllByRole("button", { name: "Alterar" })[0]);
    await user.click(screen.getByRole("button", {
      name: "Selecionar Pedicure"
    }));

    expect(screen.getByText("Aguardando serviço", { selector: "dd" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Selecione um horário" }).disabled)
      .toBe(true);
  });

  it("diferencia com clareza o estado do favorito", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "token-valido");
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith("/perfil-negocio/")) return Promise.resolve(PROFILE);
      if (path === "/favoritos/7/status") return Promise.resolve({ favoritado: false });
      if (path === "/favoritos/7" && options?.method === "POST") {
        return Promise.resolve({ favoritado: true });
      }
      return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
    });

    renderProfile();
    const favoriteButton = await screen.findByRole("button", { name: "Favoritar" });

    expect(favoriteButton.getAttribute("aria-pressed")).toBe("false");
    expect(favoriteButton.classList.contains("active")).toBe(false);

    await user.click(favoriteButton);

    const favoritedButton = screen.getByRole("button", { name: "Favoritado" });
    expect(favoritedButton.getAttribute("aria-pressed")).toBe("true");
    expect(favoritedButton.classList.contains("active")).toBe(true);
  });

  it("permite tentar novamente quando a agenda falha", async () => {
    const user = userEvent.setup();
    let scheduleAttempts = 0;

    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/perfil-negocio/")) {
        return Promise.resolve(PROFILE);
      }

      if (path.startsWith("/agenda-publica?")) {
        scheduleAttempts += 1;
        return scheduleAttempts === 1
          ? Promise.reject(new Error("Agenda temporariamente indisponivel"))
          : Promise.resolve(AVAILABILITY);
      }

      return Promise.reject(new Error(`Requisicao inesperada: ${path}`));
    });

    renderProfile();
    await user.click(await screen.findByRole("button", {
      name: "Selecionar Manicure completa"
    }));
    await user.click(screen.getByRole("button", { name: /Ana/ }));

    expect((await screen.findByRole("alert")).textContent)
      .toContain("Agenda temporariamente indisponivel");

    await user.click(screen.getByRole("button", {
      name: "Tentar novamente"
    }));

    expect(await screen.findByRole("button", { name: "09:00" }))
      .not.toBeNull();
    expect(scheduleAttempts).toBe(2);
  });

  it("mantem o perfil selecionado pela URL compartilhada", async () => {
    mockSuccessfulRequests();
    renderProfile("/negocio/studio-aurora?servico=11&profissional=22");

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining("servicoId=11&profissionalId=22"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    expect(await screen.findByRole("button", { name: "09:00" }))
      .not.toBeNull();
    expect(screen.getByText("Beatriz", { selector: "dd" })).not.toBeNull();
  });

  it("solicita localizacao somente depois da escolha da cliente", async () => {
    const user = userEvent.setup();
    const getCurrentPosition = navigator.geolocation.getCurrentPosition;

    getCurrentPosition.mockImplementation((onSuccess) => {
      onSuccess({
        coords: {
          latitude: -23.551,
          longitude: -46.634
        }
      });
    });

    mockSuccessfulRequests();
    renderProfile();

    const distanceButton = await screen.findByRole("button", {
      name: "Ver distância"
    });

    expect(getCurrentPosition).not.toHaveBeenCalled();

    await user.click(distanceButton);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/m de você|km de você/)).not.toBeNull();
  });
});
