// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { GoogleLoginButton } from "./GoogleLoginButton";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); delete window.google; });

it("ignora callbacks do Google enquanto bloqueado e depois de desmontar", async () => {
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
  apiRequest.mockResolvedValue({ googleClientId: "public-client-id" });
  const credential = vi.fn();
  const result = render(<GoogleLoginButton disabled onCredential={credential} />);
  await waitFor(() => expect(window.google.accounts.id.initialize).toHaveBeenCalled());
  const callback = window.google.accounts.id.initialize.mock.calls[0][0].callback;
  callback({ credential: "credencial-bloqueada" });
  expect(credential).not.toHaveBeenCalled();
  result.unmount();
  callback({ credential: "credencial-antiga" });
  expect(credential).not.toHaveBeenCalled();
});

it("informa que o login Google está disponível somente após renderizar o botão", async () => {
  const renderButton = vi.fn();
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
  apiRequest.mockResolvedValue({ googleClientId: "public-client-id" });
  const availability = vi.fn();
  const credential = vi.fn();
  render(<GoogleLoginButton onAvailabilityChange={availability} onCredential={credential} />);
  await waitFor(() => expect(availability).toHaveBeenCalledWith(true));
  expect(renderButton).toHaveBeenCalledTimes(1);
  window.google.accounts.id.initialize.mock.calls[0][0].callback({ credential: "credential" });
  expect(credential).toHaveBeenCalledWith("credential");
});

it("informa a indisponibilidade para não deixar uma opção de Google vazia no formulário", async () => {
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
  apiRequest.mockRejectedValue(new Error("Indisponível"));
  const availability = vi.fn();
  const result = render(<GoogleLoginButton onAvailabilityChange={availability} onCredential={vi.fn()} />);
  await waitFor(() => expect(availability).toHaveBeenCalledWith(false));
  expect(availability).not.toHaveBeenCalledWith(true);
  expect(result.container.childElementCount).toBe(0);
});
