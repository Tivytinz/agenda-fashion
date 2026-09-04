// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { sharePublicLink } from "./publicLinks";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sharePublicLink", () => {
  it("copia texto e link juntos quando Web Share não está disponível", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const result = await sharePublicLink({
      title: "Studio Rosa",
      text: "Conheça o Studio Rosa.",
      url: "https://app.agendafashion.com.br/negocio/studio-rosa?af_source=agenda_fashion",
      fallbackText:
        "Conheça o Studio Rosa.\n\nhttps://app.agendafashion.com.br/negocio/studio-rosa?af_source=agenda_fashion",
    });

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "Conheça o Studio Rosa.\n\nhttps://app.agendafashion.com.br/negocio/studio-rosa?af_source=agenda_fashion"
    );
  });
});
