// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { MyAppointmentsPage } from "./MyAppointmentsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

beforeEach(() => {
  apiRequest.mockReset();
  useSession.mockReset();
  sessionStorage.clear();
});

afterEach(cleanup);

describe("agenda da cliente", () => {
  it("volta ao modo visitante quando a sessão deixa de existir", async () => {
    let session = { authenticated: true, loading: false };
    useSession.mockImplementation(() => session);
    apiRequest.mockRejectedValue(new Error("Sessão expirada"));

    const view = render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);
    expect(await screen.findByText("Algo não saiu como esperado")).not.toBeNull();

    session = { authenticated: false, loading: false };
    view.rerender(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    expect(await screen.findByText("Agendamento como visitante")).not.toBeNull();
    expect(screen.queryByText("Algo não saiu como esperado")).toBeNull();
  });
});
