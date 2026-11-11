// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FileImagePreview } from "./FileImagePreview";

beforeEach(() => {
  let next = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:preview-${++next}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("troca a prévia e libera as URLs ao trocar o arquivo ou desmontar", () => {
  const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
  const second = new File(["second"], "second.png", { type: "image/png" });
  const view = render(<FileImagePreview alt="Capa" file={first} />);
  expect(screen.getByRole("img", { name: "Capa" }).getAttribute("src")).toBe("blob:preview-1");
  view.rerender(<FileImagePreview alt="Capa" file={second} />);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  expect(screen.getByRole("img", { name: "Capa" }).getAttribute("src")).toBe("blob:preview-2");
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-2");
});

it("não aceita texto como arquivo nem uma URL fora do protocolo local blob", () => {
  const view = render(<FileImagePreview alt="Capa" file="javascript:alert(1)" />);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole("img")).toBeNull();
  URL.createObjectURL.mockReturnValue("https://example.test/externa.jpg");
  view.rerender(<FileImagePreview alt="Capa" file={new File(["image"], "foto.jpg")} />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("https://example.test/externa.jpg");
});

it("libera todas as URLs também no ciclo adicional do StrictMode", () => {
  const file = new File(["image"], "foto.webp", { type: "image/webp" });
  const view = render(<StrictMode><FileImagePreview alt="Capa" file={file} /></StrictMode>);
  expect(screen.getByRole("img", { name: "Capa" })).not.toBeNull();
  view.unmount();
  expect(URL.revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(
    URL.createObjectURL.mock.results.map(({ value }) => value)
  );
});

it("codifica metacaracteres da URL antes de usá-la como origem da imagem", () => {
  URL.createObjectURL.mockReturnValue('blob:local/<capa>"');
  render(<FileImagePreview alt="Capa" file={new File(["image"], "foto.jpg")} />);
  expect(screen.getByRole("img", { name: "Capa" }).getAttribute("src"))
    .toBe("blob:local/%3Ccapa%3E%22");
});
