import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import reactRoutes from "../../src/config/reactRoutes.json";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useSession } from "./auth/SessionContext";
import { AppHeader } from "./components/AppHeader";
import { MarketingMetricGlossary } from "./components/MarketingMetricGlossary";
import { MetaAdsBridge } from "./components/MetaAdsBridge";
import { LegalFooter } from "./components/LegalFooter";
import {
  AdminLayout,
  WorkspaceLayout
} from "./components/WorkspaceLayout";
import { markRuntimeReady } from "./utils/runtimeRecovery";

function lazyNamed(importer, name) {
  return lazy(() =>
    importer().then((module) => {
      markRuntimeReady();
      return {
        default: module[name]
      };
    })
  );
}

function lazyNamedWithStyles(stylesImporter, importer, name) {
  return lazy(() =>
    Promise.all([stylesImporter(), importer()]).then(([, module]) => {
      markRuntimeReady();
      return {
        default: module[name]
      };
    })
  );
}

const loadAdminMarketingStyles = () =>
  import("./styles/admin-marketing.css");
const loadAdminSaasHealthStyles = () =>
  import("./styles/admin-saas-health.css");
const loadAdminWhatsAppStyles = () =>
  import("./styles/admin-whatsapp.css");
const loadDashboardStyles = () =>
  import("./styles/dashboard-polish.css");
const loadAgendaStyles = () =>
  import("./styles/agenda-polish.css");
const loadScheduleStyles = () =>
  import("./styles/schedule-polish.css");
const loadServicesStyles = () =>
  Promise.all([
    import("./styles/service-media-polish.css"),
    import("./styles/service-catalog-polish.css")
  ]);
const loadBusinessStyles = () =>
  import("./styles/business-polish.css");
const loadSubscriptionStyles = () =>
  import("./styles/subscription-polish.css");
const loadPlansStyles = () =>
  import("./styles/plans-polish.css");

const AdminMarketingPage = lazyNamedWithStyles(
  loadAdminMarketingStyles,
  () => import("./pages/AdminMarketingPage"),
  "AdminMarketingPage"
);
const AdminMarketingCostsPage = lazyNamedWithStyles(
  loadAdminMarketingStyles,
  () => import("./pages/AdminMarketingCostsPage"),
  "AdminMarketingCostsPage"
);
const AdminProfessionalFunnelPage = lazyNamedWithStyles(
  loadAdminMarketingStyles,
  () => import("./pages/AdminProfessionalFunnelPage"),
  "AdminProfessionalFunnelPage"
);
const AdminSaasHealthPage = lazyNamedWithStyles(
  loadAdminSaasHealthStyles,
  () => import("./pages/AdminSaasHealthPage"),
  "AdminSaasHealthPage"
);
const AdminWhatsAppPage = lazyNamedWithStyles(
  loadAdminWhatsAppStyles,
  () => import("./pages/AdminWhatsAppPage"),
  "AdminWhatsAppPage"
);
const AuthPage = lazyNamed(
  () => import("./pages/AuthPage"),
  "AuthPage"
);
const PasswordResetPage = lazyNamed(
  () => import("./pages/PasswordResetPage"),
  "PasswordResetPage"
);
const AgendaWorkspacePage = lazyNamedWithStyles(
  loadAgendaStyles,
  () => import("./pages/AgendaWorkspacePage"),
  "AgendaWorkspacePage"
);
const BillingCheckoutPage = lazyNamed(
  () => import("./pages/BillingPages"),
  "BillingCheckoutPage"
);
const PlansPage = lazyNamedWithStyles(
  loadPlansStyles,
  () => import("./pages/PlansPage"),
  "PlansPage"
);
const SubscriptionPage = lazyNamedWithStyles(
  loadSubscriptionStyles,
  () => import("./pages/SubscriptionPage"),
  "SubscriptionPage"
);
const BusinessPage = lazyNamedWithStyles(
  loadBusinessStyles,
  () => import("./pages/BusinessPage"),
  "BusinessPage"
);
const DashboardPage = lazyNamedWithStyles(
  loadDashboardStyles,
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
const ScheduleSettingsPage = lazyNamedWithStyles(
  loadScheduleStyles,
  () => import("./pages/ScheduleSettingsPage"),
  "ScheduleSettingsPage"
);
const ServiceEditorPage = lazyNamedWithStyles(
  loadServicesStyles,
  () => import("./pages/ServicesPage"),
  "ServiceEditorPage"
);
const ServicesPage = lazyNamedWithStyles(
  loadServicesStyles,
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
const LocalCatalogPage = lazyNamed(
  () => import("./pages/LocalCatalogPage"),
  "LocalCatalogPage"
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
const PrivacyPage = lazyNamed(
  () => import("./pages/PrivacyPage"),
  "PrivacyPage"
);
const TermsPage = lazyNamed(
  () => import("./pages/TermsPage"),
  "TermsPage"
);
const ProfessionalLandingPage = lazyNamed(
  () => import("./pages/ProfessionalLandingPage"),
  "ProfessionalLandingPage"
);
const NotFoundPage = lazyNamed(
  () => import("./pages/NotFoundPage"),
  "NotFoundPage"
);

function AccountRoute() {
  const session = useSession();

  if (session.ehAdministrador) {
    return (
      <AdminLayout>
        <AccountPage />
      </AdminLayout>
    );
  }

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
        <Route path={reactRoutes.home} element={<ExplorePage />} />
        <Route path={reactRoutes.professionalLanding} element={<ProfessionalLandingPage />} />
        <Route path={reactRoutes.localCatalog} element={<LocalCatalogPage />} />
        <Route path={reactRoutes.businessProfile} element={<ProfilePage />} />
        <Route path={reactRoutes.confirm} element={<ConfirmPage />} />
        <Route path={reactRoutes.success} element={<SuccessPage />} />
        <Route path={reactRoutes.myAgenda} element={<MyAppointmentsPage />} />
        <Route path={reactRoutes.login} element={<AuthPage />} />
        <Route path={reactRoutes.register} element={<AuthPage mode="register" />} />
        <Route path={reactRoutes.forgotPassword} element={<PasswordResetPage />} />
        <Route path={reactRoutes.resetPassword} element={<PasswordResetPage mode="reset" />} />
        <Route path={reactRoutes.privacy} element={<PrivacyPage />} />
        <Route path={reactRoutes.terms} element={<TermsPage />} />
        <Route
          element={(
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          )}
        >
          <Route
            path={reactRoutes.adminMarketing}
            element={(
              <>
                <AdminMarketingPage />
                <MarketingMetricGlossary terms={["UTM", "ATRIBUICAO", "CONVERSAO"]} />
              </>
            )}
          />
          <Route
            path={reactRoutes.adminCosts}
            element={(
              <>
                <AdminMarketingCostsPage />
                <MarketingMetricGlossary terms={["CPS", "CPA", "COBERTURA"]} />
              </>
            )}
          />
          <Route
            path={reactRoutes.adminProfessionals}
            element={(
              <>
                <AdminProfessionalFunnelPage />
                <MarketingMetricGlossary terms={["CAC", "ROAS", "COORTE", "COBERTURA"]} />
              </>
            )}
          />
          <Route
            path={reactRoutes.adminHealth}
            element={<AdminSaasHealthPage />}
          />
          <Route
            path={reactRoutes.adminWhatsapp}
            element={<AdminWhatsAppPage />}
          />
        </Route>
        <Route
          path={reactRoutes.favorites}
          element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>}
        />
        <Route
          path={reactRoutes.createBusiness}
          element={<ProtectedRoute><BusinessPage create /></ProtectedRoute>}
        />
        <Route
          path={reactRoutes.account}
          element={<ProtectedRoute><AccountRoute /></ProtectedRoute>}
        />
        <Route
          path={reactRoutes.plans}
          element={<PlansPage />}
        />
        <Route
          path={reactRoutes.checkout}
          element={<ProtectedRoute ownerOnly businessRequired><BillingCheckoutPage /></ProtectedRoute>}
        />
        <Route
          element={<ProtectedRoute businessRequired><WorkspaceLayout /></ProtectedRoute>}
        >
          <Route
            path={reactRoutes.dashboard}
            element={<ProtectedRoute ownerOnly businessRequired><DashboardPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.ownerAgenda}
            element={<ProtectedRoute ownerOnly businessRequired><AgendaWorkspacePage owner /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.services}
            element={<ProtectedRoute ownerOnly businessRequired><ServicesPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.newService}
            element={<ProtectedRoute ownerOnly businessRequired><ServiceEditorPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.editService}
            element={<ProtectedRoute ownerOnly businessRequired><ServiceEditorPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.professionals}
            element={<ProtectedRoute ownerOnly businessRequired><ProfessionalsPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.schedule}
            element={<ProtectedRoute ownerOnly businessRequired><ScheduleSettingsPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.businessSettings}
            element={<ProtectedRoute ownerOnly businessRequired><BusinessPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.subscription}
            element={<ProtectedRoute ownerOnly businessRequired><SubscriptionPage /></ProtectedRoute>}
          />
          <Route
            path={reactRoutes.professionalAgenda}
            element={<AgendaWorkspacePage />}
          />
          <Route
            path={reactRoutes.professionalSchedule}
            element={<ScheduleSettingsPage />}
          />
        </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <MetaAdsBridge />
      <LegalFooter />
    </div>
  );
}