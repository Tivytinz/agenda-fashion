import { useEffect } from "react";

function ensureMeta(selector, attributes) {
  let element = document.querySelector(selector);
  const created = !element;

  if (!element) {
    element = document.createElement("meta");

    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }

    document.head.appendChild(element);
  }

  return { element, created };
}

export function usePageMetadata(
  title,
  description,
  { canonical, robots } = {}
) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector(
      'meta[name="description"]'
    );
    const previousDescription =
      descriptionMeta?.getAttribute("content") ?? null;

    const canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    );
    const canonicalCreated = !canonicalLink && Boolean(canonical);
    const canonicalElement = canonicalLink || (
      canonical
        ? document.createElement("link")
        : null
    );
    const previousCanonical =
      canonicalElement?.getAttribute("href") ?? null;

    if (canonicalCreated && canonicalElement) {
      canonicalElement.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalElement);
    }

    let robotsMeta = null;
    let robotsCreated = false;
    let previousRobots = null;

    if (robots) {
      const ensured = ensureMeta(
        'meta[name="robots"]',
        { name: "robots" }
      );
      robotsMeta = ensured.element;
      robotsCreated = ensured.created;
      previousRobots = robotsMeta.getAttribute("content");
    }

    if (title) document.title = title;
    if (description && descriptionMeta) {
      descriptionMeta.setAttribute("content", description);
    }
    if (canonical && canonicalElement) {
      canonicalElement.setAttribute("href", canonical);
    }
    if (robots && robotsMeta) {
      robotsMeta.setAttribute("content", robots);
    }

    return () => {
      document.title = previousTitle;

      if (
        descriptionMeta &&
        previousDescription !== null
      ) {
        descriptionMeta.setAttribute(
          "content",
          previousDescription
        );
      }

      if (canonicalCreated) {
        canonicalElement?.remove();
      } else if (
        canonicalElement &&
        previousCanonical !== null
      ) {
        canonicalElement.setAttribute(
          "href",
          previousCanonical
        );
      }

      if (robotsCreated) {
        robotsMeta?.remove();
      } else if (
        robotsMeta &&
        previousRobots !== null
      ) {
        robotsMeta.setAttribute(
          "content",
          previousRobots
        );
      }
    };
  }, [canonical, description, robots, title]);
}
