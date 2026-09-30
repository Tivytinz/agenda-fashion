// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeHero } from "./HomeHero";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("interação com os destaques", () => {
  it("mantém o CTA focado no slide visível após o intervalo de rotação", () => {
    vi.useFakeTimers();
    const { container } = render(<HomeHero onExploreCategory={vi.fn()} />);
    const cta = screen.getByRole("button", { name: /Explorar serviços/ });
    act(() => cta.focus());
    act(() => vi.advanceTimersByTime(14000));

    expect(document.activeElement).toBe(cta);
    expect(cta.closest("[aria-hidden]").getAttribute("aria-hidden")).toBe("false");
    expect(container.querySelector("button").getAttribute("aria-label"))
      .toBe("Retomar rotação automática dos destaques");

    act(() => cta.blur());
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("heading", { name: "Beleza para você" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Retomar rotação/ }));
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("heading", { name: "Unhas do seu jeito" })).not.toBeNull();
  });

  it("pausa durante a leitura com o ponteiro e só retoma por escolha explícita", () => {
    vi.useFakeTimers();
    render(<HomeHero onExploreCategory={vi.fn()} />);
    const hero = screen.getByRole("region", { name: "Destaques do Agenda Fashion" });
    fireEvent.mouseEnter(hero);
    fireEvent.mouseLeave(hero);
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByRole("heading", { name: "Beleza para você" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Retomar rotação/ })).not.toBeNull();
  });
});
