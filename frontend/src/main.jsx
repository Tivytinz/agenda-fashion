import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./auth/SessionContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PublicShell } from "./components/PublicShell";
import { installRuntimeRecovery } from "./utils/runtimeRecovery";
import "./styles/index.css";
import "./styles/marketing-consent.css";
import "./styles/legal.css";
import "./styles/responsive.css";
import "./styles/af-experience.css";
import "./styles/home-discovery.css";
import "./styles/profile-polish.css";
import "./styles/account-polish.css";
import "./styles/lifecycle.css";

installRuntimeRecovery();

const router = createBrowserRouter([{
  path: "*",
  element: (
    <ErrorBoundary>
      <SessionProvider>
        <PublicShell>
          <App />
        </PublicShell>
      </SessionProvider>
    </ErrorBoundary>
  )
}]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>
);
