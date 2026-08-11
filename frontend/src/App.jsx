import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useSession } from "./auth/SessionContext";
import { AppHeader } from "./components/AppHeader";
import { WorkspaceLayout } from "./components/WorkspaceLayout";

function lazyNamed(importer, name) {
  return lazy(() =>
    importer().then((module) => ({
      default: module[name]
    }))
  );
}

const AdminMarketingPage = lazyNamed(
  () => import("./pages/AdminMarketingPage"),
  "AdminMarketingPage"
);
const AdminMarketingCostsPage = lazyNamed(
  () => import("./pages/AdminMarketingCostsPage"),
  "AdminMarketingCostsPage"
);
const AuthPage = lazyNamed(
  () => import("./pages/AuthPage"),
  "AuthPage"
);
const AgendaWorkspacePage = lazyNamed(
  () => import("./pages/AgendaWorkspacePage"),
  "AgendaWorkspacePage"
);
const BillingCheckoutPage = lazyNamed(
  () => import("./pages/BillingPages"),
  "BillingCheckoutPage"
);
const PlansPage = lazyNamed(
  () => import("./pages/BillingPages"),
  "PlansPage"
);
const SubscriptionPage = lazyNamed(
  () => import("./pages/BillingPages"),
  "SubscriptionPage"
);
const BusinessPage = lazyNamed(
  () => import("./pages/BusinessPage"),
  "BusinessPage"
);
const DashboardPage = lazyNamed(
  () => import("./pages/DashboardPage"),
  "DashboardPage"
);
const FavoritesPage = lazyNamed(
  () => import("./pages/FavoritesPage"),
  "FavoritesPage"
);
const AccountPage = lazyNamed(
  () => import("./pages/AccountPage"),
  "AccountPage"
);
const ScheduleSettingsPage = lazyNamed(
  () => import("./pages/ScheduleSettingsPage"),
  "ScheduleSettingsPage"
);
const ServiceEditorPage = lazyNamed(
  () => import("./pages/ServicesPage"),
  "ServiceEditorPage"
);
const ServicesPage = lazyNamed(
  () => import("./pages/ServicesPage"),
  "ServicesPage"
);
const ProfessionalsPage = lazyNamed(
  () => import("./pages/ProfessionalsPage"),
  "ProfessionalsPage"
);
const ConfirmPage = lazyNamed(
  () => import("./pages/ConfirmPage"),
  "ConfirmPage"
);
const ExplorePage = lazyNamed(
  () => import("./pages/ExplorePage"),
  "ExplorePage"
);
const MyAppointmentsPage = lazyNamed(
  () => import("./pages/MyAppointmentsPage"),
  "MyAppointmentsPage"
);
const ProfilePage = lazyNamed(
  () => import("./pages/ProfilePage"),
  "ProfilePage"
);
const SuccessPage = lazyNamed(
  () => import("./pages/SuccessPage"),
  "SuccessPage"
);
const NotFoundPage = lazyNamed(
  () => import("./pages/NotFoundPage"),
  "NotFoundPage"
);

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
      <Suspense fallback={<main><div className="container route-loading">Carregando...</div></main>}>
        <Routes>
        <Route path="/" element={<ExplorePage />} />
        <Route path="/negocio/:slug" element={<ProfilePage />} />
        <Route path="/confirmar" element={<ConfirmPage />} />
        <Route path="/sucesso" element={<SuccessPage />} />
        <Route path="/minha-agenda" element={<MyAppointmentsPage />} />
        <Route path="/entrar" element={<AuthPage />} />
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route
          path="/admin/trafego-pago"
          element={(
            <ProtectedRoute adminOnly>
              <AdminMarketingPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/trafego-pago/custos"
          element={(
            <ProtectedRoute adminOnly>
              <AdminMarketingCostsPage />
            </ProtectedRoute>
          )}
        />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}
