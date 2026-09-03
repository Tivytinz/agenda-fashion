import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

function scrollToHash(hash) {
  if (!hash) return false;

  let id = hash.slice(1);

  try {
    id = decodeURIComponent(id);
  } catch {
    // Mantém o fragmento original quando ele não puder ser decodificado.
  }

  const target = document.getElementById(id);

  if (!target) return false;

  target.scrollIntoView({ block: "start" });
  return true;
}

export function RouteScrollManager() {
  const { hash, pathname } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      if (scrollToHash(hash)) return undefined;

      window.scrollTo({ left: 0, top: 0 });
      const observer = new MutationObserver(() => {
        if (scrollToHash(hash)) {
          observer.disconnect();
          window.clearTimeout(timeout);
        }
      });
      const timeout = window.setTimeout(() => observer.disconnect(), 5000);

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      return () => {
        observer.disconnect();
        window.clearTimeout(timeout);
      };
    }

    window.scrollTo({ left: 0, top: 0 });
    return undefined;
  }, [hash, pathname]);

  return null;
}
