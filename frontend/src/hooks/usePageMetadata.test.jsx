// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePageMetadata } from "./usePageMetadata";

function MetadataProbe({ description, title }) {
  usePageMetadata(title, description);
  return null;
}

afterEach(cleanup);

describe("usePageMetadata", () => {
  it("atualiza e restaura titulo e descricao", () => {
    document.title = "Agenda Fashion";
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = "Descrição original";
    document.head.append(meta);

    const view = render(
      <MetadataProbe
        title="Studio Aurora | Agenda Fashion"
        description="Beleza com hora marcada"
      />
    );

    expect(document.title).toBe("Studio Aurora | Agenda Fashion");
    expect(meta.content).toBe("Beleza com hora marcada");

    view.unmount();
    expect(document.title).toBe("Agenda Fashion");
    expect(meta.content).toBe("Descrição original");
    meta.remove();
  });
});
