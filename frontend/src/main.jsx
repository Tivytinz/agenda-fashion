import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./auth/SessionContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installRuntimeRecovery } from "./utils/runtimeRecovery";
import "./styles/index.css";
import "./styles/marketing-consent.css";
import "./styles/responsive.css";
import "./styles/admin-marketing.css";
import "./styles/admin-marketing-professional.css";
import "./styles/admin-saas-health.css";
import "./styles/admin-whatsapp.css";
import "./styles/af-experience.css";
import "./styles/home-discovery.css";

installRuntimeRecovery();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
