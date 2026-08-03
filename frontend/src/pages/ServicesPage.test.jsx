// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ServiceEditorPage } from "./ServicesPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/painel/servicos/novo"]}>
      <Routes>
        <Route path="/painel/servicos/novo" element={<ServiceEditorPage />} />
        <Route path="/painel/servicos" element={<h1>Lista de serviços</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillService() {
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do serviço" }), {
    target: { value: "Manicure tradicional" }
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Valor" }), {
    target: { value: "50" }
  });
}

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: "Salvar serviço" }).closest("form"));
}

beforeEach(() => {
  apiRequest.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview")
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn()
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("editor de serviços", () => {
  it("reutiliza o serviço criado quando o upload da capa falha", async () => {
    const cover = new File(["cover"], "capa.jpg", { type: "image/jpeg" });
    apiRequest
      .mockResolvedValueOnce({ servico: { id: 33 } })
      .mockRejectedValueOnce(new Error("Falha no upload"))
      .mockResolvedValueOnce({ servico: { id: 33 } })
      .mockResolvedValueOnce({ foto_url: "https://img/capa.jpg" });

    renderEditor();
    fillService();
    fireEvent.change(screen.getByLabelText("Escolher capa"), {
      target: { files: [cover] }
    });
    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("O serviço foi salvo");
    submit();

    expect(await screen.findByRole("heading", { name: "Lista de serviços" })).not.toBeNull();
    expect(apiRequest.mock.calls.filter(([path, options]) => path === "/servicos" && options?.method === "POST")).toHaveLength(1);
    expect(apiRequest).toHaveBeenCalledWith("/servicos/33", expect.objectContaining({ method: "PUT" }));
  });

  it("não reenvia fotos da galeria que já foram concluídas", async () => {
    const first = new File(["one"], "primeira.jpg", { type: "image/jpeg" });
    const second = new File(["two"], "segunda.jpg", { type: "image/jpeg" });
    apiRequest
      .mockResolvedValueOnce({ servico: { id: 44 } })
      .mockResolvedValueOnce({ foto: { id: 1 } })
      .mockRejectedValueOnce(new Error("Falha na segunda foto"))
      .mockResolvedValueOnce({ servico: { id: 44 } })
      .mockResolvedValueOnce({ foto: { id: 2 } });

    renderEditor();
    fillService();
    fireEvent.change(screen.getByLabelText(/Adicionar à galeria/), {
      target: { files: [first, second] }
    });
    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("algumas fotos não foram enviadas");
    expect(screen.getByText("1 foto nova selecionada.")).not.toBeNull();
    submit();

    expect(await screen.findByRole("heading", { name: "Lista de serviços" })).not.toBeNull();
    const galleryUploads = apiRequest.mock.calls.filter(([path]) => path === "/servicos/44/fotos");
    expect(galleryUploads).toHaveLength(3);
    expect(galleryUploads[2][1].body.get("foto").name).toBe("segunda.jpg");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(5));
  });
});
