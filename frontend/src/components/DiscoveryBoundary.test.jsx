// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DiscoveryBoundary } from "./DiscoveryBoundary";
import { reloadWithFreshAssets } from "../utils/runtimeRecovery";
vi.mock("../utils/runtimeRecovery", () => ({ reloadWithFreshAssets: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("isola falha do catálogo e oferece atualização sem esconder o banner", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const onError = vi.fn();
  function FailedCatalog() { throw new Error("Failed to fetch dynamically imported module"); }
  render(<><h1>Banner preservado</h1><DiscoveryBoundary onError={onError}><FailedCatalog /></DiscoveryBoundary></>);
  expect(screen.getByRole("heading", { name: "Banner preservado" })).not.toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("Não conseguimos carregar o catálogo");
  expect(onError).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar página" }));
  expect(reloadWithFreshAssets).toHaveBeenCalledWith();
});
