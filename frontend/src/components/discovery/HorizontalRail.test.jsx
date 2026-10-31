// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HorizontalRail } from "./HorizontalRail";
afterEach(cleanup);
it("preserva o foco da seta no fim e impede avançar além do limite", () => {
  const { container } = render(<HorizontalRail ariaLabel="Exemplo" className="test-track"><a href="#um">Um</a><a href="#dois">Dois</a></HorizontalRail>);
  const track = container.querySelector(".test-track");
  const scrollBy = vi.fn();
  Object.defineProperties(track, { scrollWidth: { value: 600 }, clientWidth: { value: 300 }, scrollBy: { value: scrollBy } });
  fireEvent.resize(window);
  const next = screen.getByRole("button", { name: "Avançar em exemplo" });
  next.focus();
  fireEvent.click(next);
  expect(scrollBy).toHaveBeenCalledTimes(1);
  track.scrollLeft = 300;
  fireEvent.scroll(track);
  expect(document.activeElement).toBe(next);
  expect(next.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(next);
  expect(scrollBy).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Voltar em exemplo" }).getAttribute("aria-disabled")).toBe("false");
});
