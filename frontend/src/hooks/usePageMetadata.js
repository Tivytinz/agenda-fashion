import { useEffect } from "react";

export function usePageMetadata(title, description) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionMeta?.getAttribute("content") ?? null;

    if (title) document.title = title;
    if (description && descriptionMeta) descriptionMeta.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription !== null) {
        descriptionMeta.setAttribute("content", previousDescription);
      }
    };
  }, [description, title]);
}
