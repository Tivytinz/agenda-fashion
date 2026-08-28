import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./auth/SessionContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installRuntimeRecovery } from "./utils/runtimeRecovery";
import "./styles/index.css";
import "./styles/marketing-consent.css";
import "./styles/legal.css";
import "./styles/responsive.css";
import "./styles/admin-marketing.css";
import "./styles/admin-marketing-professional.css";
import "./styles/admin-marketing-v2.css";
import "./styles/admin-saas-health.css";
import "./styles/admin-whatsapp.css";
import "./styles/af-experience.css";
import "./styles/home-discovery.css";
import "./styles/profile-polish.css";
import "./styles/dashboard-polish.css";
import "./styles/agenda-polish.css";
import "./styles/service-media-polish.css";
import "./styles/service-catalog-polish.css";
import "./styles/schedule-polish.css";
import "./styles/business-polish.css";
import "./styles/subscription-polish.css";
import "./styles/plans-polish.css";
import "./styles/account-polish.css";

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
