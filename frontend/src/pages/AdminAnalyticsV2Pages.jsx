// Compatibilidade de imports; as rotas carregam cada seção diretamente.
export { AdminOverviewV2Page } from "./AdminOverviewPage";
export { AdminAcquisitionV2Page } from "./AdminAcquisitionPage";
export { AdminJourneyV2Page } from "./AdminJourneyPage";
export { AdminRetentionV2Page } from "./AdminRetentionPage";
export { AdminRevenueV2Page } from "./AdminRevenuePage";
import { formatPercent, formatSeconds, number } from "../features/admin-analytics/format";

export const adminAnalyticsV2Internals = { formatPercent, formatSeconds, number };
