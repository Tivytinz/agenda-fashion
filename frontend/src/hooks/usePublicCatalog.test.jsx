// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { usePublicCatalog } from "./usePublicCatalog";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const filters = { query: "", category: "", city: "", state: "" };

it("consulta sem atraso e descarta paginação antiga ao trocar os filtros", async () => {
  let resolveOldPage;
  apiRequest.mockResolvedValueOnce({ negocios: [{ id: 1 }], paginacao: { tem_mais: true } })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOldPage = resolve; }))
    .mockResolvedValueOnce({ negocios: [{ id: 8 }], paginacao: { tem_mais: false } });
  const { result, rerender } = renderHook((props) => usePublicCatalog(props), { initialProps: filters });
  expect(apiRequest).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(result.current.status).toBe("ready"));
  act(() => { void result.current.loadMore(); });
  const oldSignal = apiRequest.mock.calls[1][1].signal;
  rerender({ ...filters, query: "novo" });
  expect(oldSignal.aborted).toBe(true);
  expect(apiRequest.mock.calls[2][0]).toContain("busca=novo");
  await waitFor(() => expect(result.current.businesses).toEqual([{ id: 8 }]));
  await act(async () => resolveOldPage({ negocios: [{ id: 2 }] }));
  expect(result.current.businesses).toEqual([{ id: 8 }]);
});

it("serializa carregar mais e não duplica negócios repetidos entre páginas", async () => {
  let resolvePage;
  apiRequest.mockResolvedValueOnce({ negocios: [{ id: 1 }], paginacao: { tem_mais: true } })
    .mockImplementationOnce(() => new Promise((resolve) => { resolvePage = resolve; }));
  const { result } = renderHook(() => usePublicCatalog(filters));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  act(() => { void result.current.loadMore(); void result.current.loadMore(); });
  expect(apiRequest).toHaveBeenCalledTimes(2);
  await act(async () => resolvePage({ negocios: [{ id: 1 }, { id: 2 }], paginacao: { tem_mais: false } }));
  expect(result.current.businesses.map((business) => business.id)).toEqual([1, 2]);
  expect(result.current.loadingMore).toBe(false);
});

it("cancela a nova tentativa ao desmontar e não consulta quando desabilitado", async () => {
  apiRequest.mockRejectedValueOnce(new Error("Offline"))
    .mockReturnValueOnce(new Promise(() => {}));
  const { result, rerender, unmount } = renderHook((props) => usePublicCatalog(props), { initialProps: { ...filters, enabled: false } });
  expect(apiRequest).not.toHaveBeenCalled();
  rerender({ ...filters, enabled: true });
  await waitFor(() => expect(result.current.status).toBe("error"));
  act(() => { void result.current.loadBusinesses(); });
  const signal = apiRequest.mock.calls[1][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});
