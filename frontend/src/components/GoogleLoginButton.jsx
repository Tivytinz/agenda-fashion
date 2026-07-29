import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";

const SCRIPT_ID = "google-identity-services";

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

export function GoogleLoginButton({ onCredential, onError }) {
  const containerRef = useRef(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest("/auth/configuracao-publica"),
      loadGoogleScript()
    ])
      .then(([config]) => {
        if (!active || !containerRef.current) return;

        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: ({ credential }) => onCredential(credential)
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: Math.min(containerRef.current.clientWidth || 360, 400)
        });
      })
      .catch((error) => {
        if (active) {
          setAvailable(false);
          onError?.(error);
        }
      });

    return () => {
      active = false;
    };
  }, [onCredential, onError]);

  if (!available) {
    return null;
  }

  return <div className="google-login" ref={containerRef} />;
}
