// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";
import { ServiceEditorPage } from "./ServicesPage";
import { ScheduleSettingsPage } from "./ScheduleSettingsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({ refresh: vi.fn().mockResolvedValue({}), usuario: { id: 4 }, negocio: { id: 11, papel: "dono" } })
}));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));

const BUSINESS = {
  id: 11, nome: "Studio Aurora", slug: "studio-aurora", areas: ["Unhas"],
  whatsapp: "11999999999", cidade: "São Paulo", estado: "SP", bairro: "Centro",
  endereco: "Rua das Flores", numero: "10", cep: "01001000",
  localizacao_url: "https://maps.google.com/?q=studio", publicado: true
};
const SERVICE = { id: 12, nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true };
const CONFIG = {
  duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0,
  antecedencia_cancelamento: 2, origem_horarios: "personalizado",
  configurado_em: "2026-10-10T00:00:00.000Z"
};
const WEEK = [{ dia_semana: 1, trabalha: true, hora_inicio: "08:00", hora_fim: "18:00", intervalo_inicio: null, intervalo_fim: null }];
let router;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mount(path, element) {
  router = createMemoryRouter([
    { path: path.split("?")[0].replace("/12/editar", "/:id/editar"), element },
    { path: "/painel/servicos/novo", element: <ServiceEditorPage /> },
    { path: "*", element: <h1>Destino</h1> }
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  router?.dispose();
  vi.restoreAllMocks();
});

describe("contexto da agenda sem reaproveitar horários de outra pessoa", () => {
  function scheduleResult(start, professional) {
    return {
      configuracao: CONFIG,
      horarios: [{ ...WEEK[0], hora_inicio: start }],
      profissional: professional
    };
  }

  it("aguarda a agenda da dona, permite repetir uma falha e só envia a semana do novo contexto", async () => {
    const ownSchedule = deferred();
    let ownAttempts = 0;
    let submitted;
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") {
        submitted = options.body;
        return Promise.resolve({ configuracao: CONFIG });
      }
      if (path.includes("profissionalId=22")) return Promise.resolve(scheduleResult("14:00", { id: 22, nome: "Alice" }));
      ownAttempts += 1;
      return ownAttempts === 1 ? ownSchedule.promise : Promise.resolve(scheduleResult("08:00"));
    });
    mount("/painel/horarios?profissional=22", <ScheduleSettingsPage />);
    expect((await screen.findByLabelText("Início do atendimento de Segunda")).value).toBe("14:00");
    await act(() => router.navigate("/painel/horarios"));
    expect(screen.getByText("Carregando horários...")).toBeTruthy();
    expect(screen.queryByLabelText("Início do atendimento de Segunda")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar horários" })).toBeNull();
    expect(submitted).toBeUndefined();
    await act(() => ownSchedule.reject(new Error("Agenda da dona indisponível")));
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Início do atendimento de Segunda")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((await screen.findByLabelText("Início do atendimento de Segunda")).value).toBe("08:00");
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    await waitFor(() => expect(submitted?.horarios[0].horaInicio).toBe("08:00"));
    expect(submitted.profissionalId).toBeUndefined();
  });

  it.each(["sucesso", "falha"])("ignora %s de uma leitura antiga sem apagar a edição da profissional atual", async (outcome) => {
    const oldSchedule = deferred();
    let submitted;
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") {
        submitted = options.body;
        return Promise.resolve({ configuracao: CONFIG });
      }
      return path.includes("profissionalId=22")
        ? oldSchedule.promise
        : Promise.resolve(scheduleResult("14:00", { id: 33, nome: "Bia" }));
    });
    mount("/painel/horarios?profissional=22", <ScheduleSettingsPage />);
    await act(() => router.navigate("/painel/horarios?profissional=33"));
    const start = await screen.findByLabelText("Início do atendimento de Segunda");
    fireEvent.change(start, { target: { value: "15:00" } });
    await act(() => outcome === "sucesso"
      ? oldSchedule.resolve(scheduleResult("10:00", { id: 22, nome: "Alice" }))
      : oldSchedule.reject(new Error("Erro da agenda anterior")));
    expect(start.value).toBe("15:00");
    expect(screen.getByText("Bia")).toBeTruthy();
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(apiRequest.mock.calls.find(([path]) => path.includes("profissionalId=22"))[1].signal.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    await waitFor(() => expect(submitted?.profissionalId).toBe(33));
    expect(submitted.horarios[0].horaInicio).toBe("15:00");
    expect(submitted).not.toHaveProperty("antecedenciaCancelamento");
  });

  it("mantém a proteção de rascunho antes de trocar de pessoa", async () => {
    apiRequest.mockImplementation(path => Promise.resolve(scheduleResult(path.includes("profissionalId=22") ? "14:00" : "08:00")));
    mount("/painel/horarios?profissional=22", <ScheduleSettingsPage />);
    const start = await screen.findByLabelText("Início do atendimento de Segunda");
    fireEvent.change(start, { target: { value: "15:00" } });
    await act(() => router.navigate("/painel/horarios"));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar editando" }));
    expect(router.state.location.search).toBe("?profissional=22");
    expect(start.value).toBe("15:00");
    await act(() => router.navigate("/painel/horarios"));
    fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    await waitFor(() => expect(screen.getByLabelText("Início do atendimento de Segunda").value).toBe("08:00"));
    expect(router.state.location.search).toBe("");
  });

  it("não aplica uma resposta de salvamento à agenda de outra profissional", async () => {
    const oldSave = deferred();
    let savedFor;
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") {
        savedFor = options.body.profissionalId;
        return oldSave.promise;
      }
      return Promise.resolve(scheduleResult(path.includes("profissionalId=22") ? "14:00" : "08:00"));
    });
    mount("/painel/horarios?profissional=22", <ScheduleSettingsPage />);
    await screen.findByLabelText("Início do atendimento de Segunda");
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    expect(savedFor).toBe(22);
    await act(() => router.navigate("/painel/horarios?profissional=33"));
    await screen.findByLabelText("Início do atendimento de Segunda");
    await act(() => oldSave.resolve({ configuracao: CONFIG, mensagem: "Agenda anterior salva" }));
    expect(screen.getByLabelText("Início do atendimento de Segunda").value).toBe("08:00");
    expect(screen.queryByText("Agenda anterior salva")).toBeNull();
    expect(router.state.location.search).toBe("?profissional=33");
  });

  it("não reabre a divulgação quando a dona já saiu para outra agenda", async () => {
    const activation = deferred();
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/dashboard-dono/ativacao") return activation.promise;
      if (options.method === "PUT") return Promise.resolve({ configuracao: CONFIG });
      return Promise.resolve(path.includes("profissionalId=33")
        ? scheduleResult("14:00", { id: 33, nome: "Bia" })
        : { ...scheduleResult("08:00"), configuracao: { ...CONFIG, origem_horarios: "padrao_af" } });
    });
    mount("/painel/horarios", <ScheduleSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/dashboard-dono/ativacao",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    await act(() => router.navigate("/painel/horarios?profissional=33"));
    await screen.findByText("Bia");
    await act(() => activation.resolve({
      negocio: { id: 11, nome: "Studio Aurora", slug: "studio-aurora" },
      ativacao: { possui_disponibilidade_agendavel: true },
      proxima_acao_ativacao: { estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO" }
    }));
    expect(router.state.location.search).toBe("?profissional=33");
    expect(screen.getByLabelText("Início do atendimento de Segunda").value).toBe("14:00");
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" })).toBeNull();
  });
});

describe("CEP sem substituir o preenchimento manual", () => {
  it("preserva campos editados durante a consulta e preenche os demais antes de salvar", async () => {
    const cep = deferred();
    let submitted;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.startsWith("/cep/")) return cep.promise;
      if (options.method === "PUT") submitted = options.body;
      return Promise.resolve({ negocio: { ...BUSINESS, ...options.body } });
    });
    mount("/painel/negocio", <BusinessPage />);
    fireEvent.change(await screen.findByLabelText(/^CEP/), { target: { value: "74000123" } });
    fireEvent.change(screen.getByLabelText("Endereço"), { target: { value: "Rua manual" } });
    fireEvent.change(screen.getByLabelText("Endereço"), { target: { value: BUSINESS.endereco } });
    fireEvent.change(screen.getByLabelText("Bairro"), { target: { value: "Bairro manual" } });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "SP" } });
    await act(() => cep.resolve({ endereco: "Rua do CEP", bairro: "Bairro do CEP", cidade: "Goiânia", estado: "GO" }));
    expect(screen.getByLabelText("Endereço").value).toBe(BUSINESS.endereco);
    expect(screen.getByLabelText("Bairro").value).toBe("Bairro manual");
    expect(screen.getByLabelText("Estado").value).toBe("SP");
    expect(screen.getByLabelText("Cidade").value).toBe("Goiânia");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(submitted?.bairro).toBe("Bairro manual"));
    expect(submitted.endereco).toBe(BUSINESS.endereco);
    expect(submitted.estado).toBe("SP");
    expect(submitted.cidade).toBe("Goiânia");
  });

  it("mantém o rascunho manual durante o preenchimento auxiliar do perfil carregado", async () => {
    const cep = deferred();
    apiRequest.mockImplementation(path => path.startsWith("/cep/")
      ? cep.promise
      : Promise.resolve({ negocio: { ...BUSINESS, endereco: "" } }));
    mount("/painel/negocio", <BusinessPage />);
    const address = await screen.findByLabelText("Endereço");
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.startsWith("/cep/"))).toBe(true));
    fireEvent.change(address, { target: { value: "Rua informada pela dona" } });
    await act(() => cep.resolve({ endereco: "Rua do CEP", bairro: "Centro", cidade: "São Paulo", estado: "SP" }));
    expect(address.value).toBe("Rua informada pela dona");
    await act(() => router.navigate("/saida"));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar editando" }));
    expect(address.value).toBe("Rua informada pela dona");
  });
});

describe("recuperação de uploads parcialmente concluídos", () => {
  it("uma leitura atrasada da galeria preserva a foto enviada depois de seu início", async () => {
    const user = userEvent.setup();
    const gallery = deferred();
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.endsWith("/fotos")) {
        if (options.method !== "POST") return gallery.promise;
        return options.body.get("foto").name === "salva.jpg"
          ? Promise.resolve({ foto: { id: 42, foto_url: "https://img/salva.jpg" } })
          : Promise.reject(new Error("Falha na foto restante"));
      }
      return Promise.resolve(options.method === "PUT" ? { servico: SERVICE } : { servicos: [SERVICE] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByLabelText("Nome do serviço");
    await user.upload(screen.getByLabelText("Adicionar fotos à galeria"), [
      new File(["a"], "salva.jpg", { type: "image/jpeg" }),
      new File(["b"], "pendente.jpg", { type: "image/jpeg" })
    ]);
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await screen.findByRole("alert");
    await act(() => gallery.resolve({ fotos: [{ id: 21, foto_url: "https://img/antiga.jpg" }] }));
    expect(screen.getAllByAltText("Foto da galeria de Manicure").map(image => image.getAttribute("src")))
      .toEqual(["https://img/antiga.jpg", "https://img/salva.jpg"]);
    expect(screen.getByText("1 foto selecionada.")).toBeTruthy();
  });

  it("mostra a capa e a foto já salvas e repete apenas o arquivo pendente", async () => {
    const user = userEvent.setup();
    const oldCover = { foto_url: "https://img/antiga.jpg", foto_public_id: "old" };
    const newCover = { foto_url: "https://img/nova.jpg", foto_public_id: "new" };
    const uploads = [];
    let coverUploads = 0;
    let failed = false;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/servicos/12/foto") {
        coverUploads += 1;
        return Promise.resolve({ servico: { ...SERVICE, ...newCover } });
      }
      if (path === "/servicos/12/fotos" && options.method === "POST") {
        const filename = options.body.get("foto").name;
        uploads.push(filename);
        if (filename === "pendente.jpg" && !failed) {
          failed = true;
          return Promise.reject(new Error("Falha temporária na galeria"));
        }
        return Promise.resolve({ foto: { id: filename === "salva.jpg" ? 32 : 33, foto_url: `https://img/${filename}` } });
      }
      if (path === "/servicos/12/fotos/tentativa") return Promise.resolve({ estado: "nao_encontrada" });
      if (path.endsWith("/fotos")) return Promise.resolve([{ id: 31, ...oldCover }]);
      return Promise.resolve(options.method === "PUT" ? { servico: SERVICE } : { servicos: [{ ...SERVICE, ...oldCover }] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByRole("button", { name: "Remover foto da galeria" });
    await user.upload(screen.getByLabelText("Trocar capa"), new File(["a"], "capa.jpg", { type: "image/jpeg" }));
    await user.upload(screen.getByLabelText("Adicionar fotos à galeria"), [
      new File(["b"], "salva.jpg", { type: "image/jpeg" }),
      new File(["c"], "pendente.jpg", { type: "image/jpeg" })
    ]);
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await screen.findByRole("alert");
    expect(screen.getByAltText("Capa atual do serviço Manicure").getAttribute("src")).toBe(newCover.foto_url);
    expect(screen.getAllByAltText("Foto da galeria de Manicure").some(image => image.getAttribute("src") === "https://img/salva.jpg")).toBe(true);
    expect(screen.getByText("1 foto selecionada.")).toBeTruthy();
    expect(uploads).toEqual(["salva.jpg", "pendente.jpg"]);
    await user.click(screen.getByRole("button", { name: "Verificar fotos" }));
    await screen.findByRole("button", { name: "Salvar serviço" });
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(coverUploads).toBe(1);
    expect(uploads).toEqual(["salva.jpg", "pendente.jpg", "pendente.jpg"]);
    expect(router.state.location.pathname).toBe("/painel/servicos");
  });
});

describe("salvamento sem perder edições", () => {
  it.each([
    ["negócio", "/painel/negocio", <BusinessPage />, "Nome do negócio", "Nome enviado", "Nome após falha", "Salvar alterações", "nome"],
    ["horários", "/painel/horarios", <ScheduleSettingsPage />, "Antecedência para cancelar", "4", "6", "Salvar horários", "antecedenciaCancelamento"]
  ])("bloqueia alterações de %s durante o PUT e permite editar e repetir após falha", async (_name, path, element, label, firstValue, retryValue, button, payloadField) => {
    const user = userEvent.setup();
    const save = deferred();
    const submissions = [];
    apiRequest.mockImplementation((_path, options = {}) => {
      const body = options.body;
      if (options.method === "PUT") {
        submissions.push(body);
        if (submissions.length === 1) return save.promise;
      }
      return Promise.resolve(path.includes("negocio")
        ? { negocio: { ...BUSINESS, ...body }, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } }
        : { configuracao: CONFIG, horarios: body?.horarios || WEEK });
    });
    mount(path, element);
    const field = await screen.findByLabelText(label);
    fireEvent.change(field, { target: { value: firstValue } });
    await user.click(screen.getByRole("button", { name: button }));

    const form = field.closest("form");
    expect([...form.querySelectorAll("input,textarea,select")].every(input => input.matches(":disabled"))).toBe(true);
    await user.type(field, "9");
    expect(field.value).toBe(firstValue);
    fireEvent.submit(form);
    expect(submissions).toHaveLength(1);

    await act(() => save.reject(new Error("Falha temporária no salvamento")));
    await screen.findByRole("alert");
    expect(field.disabled).toBe(false);
    expect(field.value).toBe(firstValue);
    fireEvent.change(field, { target: { value: retryValue } });
    await user.click(screen.getByRole("button", { name: button }));
    await waitFor(() => expect(form.getAttribute("aria-busy")).toBe("false"));
    expect(String(submissions[1][payloadField])).toBe(retryValue);
    expect(field.value).toBe(retryValue);
    await act(() => router.navigate("/saida"));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("aguarda a consulta do CEP antes de salvar o endereço completo", async () => {
    const cep = deferred();
    let savedBody;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.startsWith("/cep/")) return cep.promise;
      if (options.method === "PUT") savedBody = options.body;
      return Promise.resolve({ negocio: { ...BUSINESS, ...options.body } });
    });
    mount("/painel/negocio", <BusinessPage />);
    const field = await screen.findByLabelText(/^CEP/);
    fireEvent.change(field, { target: { value: "74000123" } });
    const save = screen.getByRole("button", { name: "Salvar alterações" });
    expect(save.disabled).toBe(true);
    fireEvent.submit(field.closest("form"));
    expect(savedBody).toBeUndefined();
    await act(() => cep.resolve({ endereco: "Rua nova", bairro: "Setor Central", cidade: "Goiânia", estado: "GO" }));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(savedBody?.endereco).toBe("Rua nova"));
    expect(savedBody.cep).toBe("74000123");
  });

  it("bloqueia nova seleção durante upload e preserva a capa para recuperar uma falha", async () => {
    const user = userEvent.setup();
    const upload = deferred();
    const uploads = [];
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/servicos/12/foto") {
        uploads.push(options.body);
        return uploads.length === 1 ? upload.promise : Promise.resolve({ foto_url: "https://img/nova.jpg" });
      }
      if (path.endsWith("/fotos")) return Promise.resolve([]);
      return Promise.resolve(options.method === "PUT" ? { servico: SERVICE } : { servicos: [SERVICE] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByDisplayValue("Manicure");
    const first = new File(["a"], "primeira.jpg", { type: "image/jpeg" });
    const second = new File(["b"], "nova-escolha.jpg", { type: "image/jpeg" });
    const cover = screen.getByLabelText("Escolher capa");
    await user.upload(cover, first);
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(cover.disabled).toBe(true);
    expect(screen.getByLabelText("Adicionar fotos à galeria").disabled).toBe(true);
    expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
    await user.upload(cover, second);
    expect(uploads[0].get("foto").name).toBe("primeira.jpg");
    await act(() => upload.reject(new Error("Upload indisponível")));
    await screen.findByRole("alert");
    expect(cover.disabled).toBe(true);
    expect(screen.getByAltText("Prévia da nova capa")).toBeTruthy();
    await act(() => router.navigate("/saida"));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar editando" }));
    await user.click(screen.getByRole("button", { name: "Verificar fotos" }));
    await screen.findByText(/Capa atual conferida/);
    expect(cover.disabled).toBe(false);
    await user.upload(cover, second);
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(uploads).toHaveLength(2);
    expect(uploads[1].get("foto").name).toBe("nova-escolha.jpg");
    expect(router.state.location.pathname).toBe("/painel/servicos");
  });
});

describe("carregamento independente do editor de serviço", () => {
  it("libera o formulário enquanto as fotos carregam e preserva as edições quando chegam", async () => {
    const gallery = deferred();
    apiRequest.mockImplementation(path => path.endsWith("/fotos") ? gallery.promise : Promise.resolve({ servicos: [SERVICE] }));
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    const name = await screen.findByLabelText("Nome do serviço");
    expect(name.value).toBe("Manicure");
    expect(screen.getByText("Carregando fotos...")).toBeTruthy();
    fireEvent.change(name, { target: { value: "Manicure completa" } });
    await act(() => gallery.resolve([{ id: 31, foto_url: "https://img/foto.jpg" }]));
    await screen.findByRole("button", { name: "Remover foto da galeria" });
    expect(name.value).toBe("Manicure completa");
    expect(screen.queryByText("Carregando fotos...")).toBeNull();
  });

  it("repete apenas a galeria após falha sem apagar a edição dos dados essenciais", async () => {
    let galleryAttempts = 0;
    apiRequest.mockImplementation(path => {
      if (path.endsWith("/fotos")) {
        galleryAttempts += 1;
        return galleryAttempts === 1
          ? Promise.reject(new Error("Fotos indisponíveis"))
          : Promise.resolve([{ id: 31, foto_url: "https://img/foto.jpg" }]);
      }
      return Promise.resolve({ servicos: [SERVICE] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByRole("alert");
    const name = screen.getByLabelText("Nome do serviço");
    expect(name.value).toBe("Manicure");
    expect(screen.getByRole("spinbutton", { name: "Valor" }).value).toBe("50");
    fireEvent.change(name, { target: { value: "Manicure completa" } });
    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar fotos novamente" }));
    await screen.findByRole("button", { name: "Remover foto da galeria" });
    expect(name.value).toBe("Manicure completa");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(apiRequest.mock.calls.filter(([path]) => path === "/servicos")).toHaveLength(1);
    expect(galleryAttempts).toBe(2);
  });

  it("oferece repetir a carga principal em vez de apresentar um serviço vazio", async () => {
    let attempts = 0;
    apiRequest.mockImplementation(path => {
      if (path.endsWith("/fotos")) return Promise.resolve([]);
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error("Serviço indisponível")) : Promise.resolve({ servicos: [SERVICE] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Nome do serviço")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((await screen.findByLabelText("Nome do serviço")).value).toBe("Manicure");
    expect(attempts).toBe(2);
  });

  it("ignora a galeria de outro serviço quando uma requisição antiga termina depois", async () => {
    const oldGallery = deferred();
    apiRequest.mockImplementation(path => {
      if (path === "/servicos/12/fotos") return oldGallery.promise;
      if (path === "/servicos/34/fotos") return Promise.resolve([{ id: 41, foto_url: "https://img/nova.jpg" }]);
      return Promise.resolve({ servicos: [SERVICE, { ...SERVICE, id: 34, nome: "Pedicure" }] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByDisplayValue("Manicure");
    await act(() => router.navigate("/painel/servicos/34/editar"));
    await screen.findByDisplayValue("Pedicure");
    await screen.findByText("1 foto");
    await act(() => oldGallery.resolve([{ id: 21, foto_url: "https://img/antiga.jpg" }, { id: 22, foto_url: "https://img/antiga-2.jpg" }]));
    expect(screen.getByLabelText("Nome do serviço").value).toBe("Pedicure");
    expect(screen.getAllByRole("button", { name: "Remover foto da galeria" })).toHaveLength(1);
    expect(apiRequest.mock.calls.find(([path]) => path === "/servicos/12/fotos")[1].signal.aborted).toBe(true);
  });

  it("não reaproveita fotos de outro serviço quando a nova galeria falha", async () => {
    apiRequest.mockImplementation(path => {
      if (path === "/servicos/12/fotos") return Promise.resolve([{ id: 21, foto_url: "https://img/antiga.jpg" }]);
      if (path === "/servicos/34/fotos") return Promise.reject(new Error("Fotos indisponíveis"));
      return Promise.resolve({ servicos: [SERVICE, { ...SERVICE, id: 34, nome: "Pedicure" }] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByRole("button", { name: "Remover foto da galeria" });
    await act(() => router.navigate("/painel/servicos/34/editar"));
    await screen.findByDisplayValue("Pedicure");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Remover foto da galeria" })).toBeNull();
  });

  it("inicia um cadastro novo sem reutilizar dados, fotos ou o ID do editor anterior", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.endsWith("/fotos")) return Promise.resolve([{ id: 21, foto_url: "https://img/antiga.jpg" }]);
      if (options.method === "POST") return Promise.resolve({ servico: { id: 45 } });
      return Promise.resolve({ servicos: [SERVICE] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByRole("button", { name: "Remover foto da galeria" });
    await act(() => router.navigate("/painel/servicos/novo"));
    const name = await screen.findByLabelText("Nome do serviço");
    expect(name.value).toBe("");
    expect(screen.queryByRole("button", { name: "Remover foto da galeria" })).toBeNull();
    fireEvent.change(name, { target: { value: "Pedicure" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "unha" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor" }), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await screen.findByRole("heading", { name: "Destino" });
    const writes = apiRequest.mock.calls.filter(([, options]) => options?.method);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual(["/servicos", expect.objectContaining({ method: "POST", body: expect.objectContaining({ nome: "Pedicure" }) })]);
  });
});
