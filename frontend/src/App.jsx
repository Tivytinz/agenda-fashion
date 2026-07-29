import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useSession } from "./auth/SessionContext";
import { AppHeader } from "./components/AppHeader";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { AuthPage } from "./pages/AuthPage";
import { AgendaWorkspacePage } from "./pages/AgendaWorkspacePage";
import { BillingCheckoutPage, PlansPage, SubscriptionPage } from "./pages/BillingPages";
import { BusinessPage } from "./pages/BusinessPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { AccountPage } from "./pages/AccountPage";
import { ScheduleSettingsPage } from "./pages/ScheduleSettingsPage";
import { ServiceEditorPage, ServicesPage } from "./pages/ServicesPage";
import { ProfessionalsPage } from "./pages/ProfessionalsPage";
import { ConfirmPage } from "./pages/ConfirmPage";
import { ExplorePage } from "./pages/ExplorePage";
import { MyAppointmentsPage } from "./pages/MyAppointmentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SuccessPage } from "./pages/SuccessPage";

function AccountRoute() {
  const session = useSession();

  if (session.temNegocio) {
    return (
      <WorkspaceLayout>
        <AccountPage />
      </WorkspaceLayout>
    );
  }

  return <AccountPage />;
}

export default function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <Routes>
        <Route path="/" element={<ExplorePage />} />
        <Route path="/negocio/:slug" element={<ProfilePage />} />
        <Route path="/confirmar" element={<ConfirmPage />} />
        <Route path="/sucesso" element={<SuccessPage />} />
        <Route path="/minha-agenda" element={<MyAppointmentsPage />} />
        <Route path="/entrar" element={<AuthPage />} />
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route
          path="/favoritos"
          element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>}
        />
        <Route
          path="/criar-negocio"
          element={<ProtectedRoute><BusinessPage create /></ProtectedRoute>}
        />
        <Route
          path="/conta"
          element={<ProtectedRoute><AccountRoute /></ProtectedRoute>}
        />
        <Route
          path="/planos"
          element={<PlansPage />}
        />
        <Route
          path="/checkout"
          element={<ProtectedRoute ownerOnly businessRequired><BillingCheckoutPage /></ProtectedRoute>}
        />
        <Route
          element={<ProtectedRoute businessRequired><WorkspaceLayout /></ProtectedRoute>}
        >
          <Route
            path="/painel"
            element={<ProtectedRoute ownerOnly businessRequired><DashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/agenda"
            element={<ProtectedRoute ownerOnly businessRequired><AgendaWorkspacePage owner /></ProtectedRoute>}
          />
          <Route
            path="/painel/servicos"
            element={<ProtectedRoute ownerOnly businessRequired><ServicesPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/servicos/novo"
            element={<ProtectedRoute ownerOnly businessRequired><ServiceEditorPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/servicos/:id/editar"
            element={<ProtectedRoute ownerOnly businessRequired><ServiceEditorPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/profissionais"
            element={<ProtectedRoute ownerOnly businessRequired><ProfessionalsPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/horarios"
            element={<ProtectedRoute ownerOnly businessRequired><ScheduleSettingsPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/negocio"
            element={<ProtectedRoute ownerOnly businessRequired><BusinessPage /></ProtectedRoute>}
          />
          <Route
            path="/painel/assinatura"
            element={<ProtectedRoute ownerOnly businessRequired><SubscriptionPage /></ProtectedRoute>}
          />
          <Route
            path="/profissional/agenda"
            element={<AgendaWorkspacePage />}
          />
          <Route
            path="/profissional/horarios"
            element={<ScheduleSettingsPage />}
          />
        </Route>
        <Route path="*" element={<ExplorePage />} />
      </Routes>
    </div>
  );
}
