// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeHero } from "./HomeHero";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("interação com os destaques", () => {
  it("mantém o destaque e o foco estáveis sem avanço automático", () => {
    vi.useFakeTimers();
    const { container } = render(<HomeHero onExploreCategory={vi.fn()} />);
    const cta = screen.getByRole("button", { name: "Ver serviços de cabelo" });
    act(() => cta.focus());
    act(() => vi.advanceTimersByTime(60000));
    expect(document.activeElement).toBe(cta);
    expect(screen.getByRole("heading", { name: "Beleza para você" })).not.toBeNull();
    expect(container.querySelectorAll(".home-hero-image")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /rotação automática/ })).toBeNull();
  });

  it("permite escolher o destaque por gesto e voltar pelos controles", () => {
    render(<HomeHero onExploreCategory={vi.fn()} />);
    const hero = screen.getByRole("region", { name: "Destaques do Agenda Fashion" });
    fireEvent.touchStart(hero, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getByRole("heading", { name: "Unhas do seu jeito" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Destaque anterior" }));
    expect(screen.getByRole("heading", { name: "Beleza para você" })).not.toBeNull();
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
  expect(container.querySelectorAll(".home-hero-image")).toHaveLength(1);
  const visitedSources = [];
  expected.forEach(([category, filename], index) => {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Mostrar destaque ${index + 1}:`) }));
    const image = slides[index].querySelector("img");
    expect(image.getAttribute("src")).toContain(filename);
    visitedSources.push(image.getAttribute("src"));
    expect(image.getAttribute("loading")).toBe(index === 0 ? "eager" : "lazy");
    fireEvent.click(screen.getByRole("button", { name: /Ver serviços de cabelo|Encontrar manicure|Ver serviços de estética|Ver bronzeamento|Ver serviços de cílios|Ver design de sobrancelhas|Encontrar maquiagem/ }));
    expect(onExploreCategory).toHaveBeenLastCalledWith(category);
  });
  expect(new Set(visitedSources).size).toBe(7);
  expect(slides[0].querySelector("source").getAttribute("srcset"))
    .toBe("/assets/home/salon-hero-mobile.webp");
});


it("carrega a imagem secundária somente quando a pessoa avança o slide", () => {
  vi.useFakeTimers();
  const { container } = render(<HomeHero onExploreCategory={vi.fn()} />);
  expect(container.querySelectorAll(".home-hero-image")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Próximo destaque" }));
  expect(container.querySelector('[aria-hidden="false"] img').getAttribute("src")).toContain("manicure-hero.webp");
  expect(container.querySelector('img[src*="skincare-hero"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Destaque anterior" }));
  expect(container.querySelector('[aria-hidden="false"] img').getAttribute("src")).toContain("salon-hero-wide.webp");
});
