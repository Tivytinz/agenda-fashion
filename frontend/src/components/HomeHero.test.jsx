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
    const cta = screen.getByRole("button", { name: /Ver serviços de cabelo|Encontrar manicure|Ver serviços de estética|Ver bronzeamento|Ver serviços de cílios|Ver design de sobrancelhas|Encontrar maquiagem/ });
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


it("associa cada categoria à sua imagem original e ao destino correto", () => {
  const onExploreCategory = vi.fn();
  const { container } = render(<HomeHero onExploreCategory={onExploreCategory} />);
  const slides = Array.from(container.querySelectorAll(".home-hero-slide"));
  const expected = [
    ["cabelo", "salon-hero-wide.webp"],
    ["unha", "manicure-hero.webp"],
    ["estetica", "skincare-hero.webp"],
    ["bronzeamento", "bronzeamento-hero.webp"],
    ["cilio", "cilios-hero.webp"],
    ["sobrancelha", "sobrancelhas-hero.webp"],
    ["maquiagem", "maquiagem-hero.webp"]
  ];
  expect(slides).toHaveLength(expected.length);
  expected.forEach(([category, filename], index) => {
    const image = slides[index].querySelector("img");
    expect(image.getAttribute("src")).toContain(filename);
    expect(image.getAttribute("loading")).toBe(index === 0 ? "eager" : "lazy");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Mostrar destaque ${index + 1}:`) }));
    fireEvent.click(screen.getByRole("button", { name: /Ver serviços de cabelo|Encontrar manicure|Ver serviços de estética|Ver bronzeamento|Ver serviços de cílios|Ver design de sobrancelhas|Encontrar maquiagem/ }));
    expect(onExploreCategory).toHaveBeenLastCalledWith(category);
  });
  expect(new Set(slides.map(slide => slide.querySelector("img").getAttribute("src"))).size).toBe(7);
  expect(slides[0].querySelector("source").getAttribute("srcset"))
    .toBe("/assets/home/salon-hero-mobile.webp");
});
