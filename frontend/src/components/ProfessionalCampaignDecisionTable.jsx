import { Fragment } from "react";
import {
  campaignKey,
  campaignLabel,
  campaignMediumLabel,
  campaignSourceMeta,
  decisionBadgeClass,
  decisionSignalLabel,
  formatCampaignMoney,
  formatCampaignRoas,
  isOrganicCampaign,
  utmIdentityLabel
} from "../utils/professionalCampaigns";

export function ProfessionalCampaignDecisionTable({
  campaigns,
  decision,
  expandedCampaign,
  measurementReady,
  onToggle
}) {
  if (campaigns.length === 0) {
    return (
      <p className="muted">
        Ainda não há campanhas com atribuição oficial nesta coorte.
      </p>
    );
  }

  return (
    <div className="table-wrap admin-chart-table-spacing">
      <table className="admin-decision-table">
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Investimento</th>
            <th>Receita</th>
            <th>ROAS</th>
            <th>CAC</th>
            <th>Decisão</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((item) => {
            const key = campaignKey(item);
            const expanded = expandedCampaign === key;
            const source = campaignSourceMeta(item);
            const medium = campaignMediumLabel(item);
            const identities = Array.isArray(item.identidadesUtm)
              ? item.identidadesUtm
              : [];

            return (
              <Fragment key={key}>
                <tr>
                  <td>
                    <strong>{campaignLabel(item)}</strong>
                    <div className="admin-campaign-source">
                      <span className={`admin-status-badge admin-source-badge is-${source.…104619 tokens truncated…ground: #fff;
  font-weight: 800;
  text-decoration: none;
}

.account-button .account-avatar {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #fff;
  background: var(--pink-600);
  font-size: 0.9rem;
  font-weight: 900;
}

.workspace-mobile-nav {
  display: none;
}

.af-media-thumb {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--pink-100);
  color: var(--pink-700);
  background: linear-gradient(145deg, var(--pink-50), #fde2ed);
}

.af-media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.af-media-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-items: center;
  place-items: center;
  line-height: 1;
  text-align: center;
  font-size: 1.55rem;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-action-button {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--pink-100);
  border-radius: 999px;
  padding-inline: 18px;
  color: var(--wine);
  background: #fff;
  font-weight: 850;
  text-decoration: none;
}

.profile-action-button.whatsapp::before {
  margin-right: 7px;
  content: "◉";
}

.profile-action-button.maps::before {
  margin-right: 7px;
  content: "⌖";
}

.choice-media {
  width: 62px;
  height: 62px;
  border-radius: 16px;
}

.professional-media {
  width: 54px;
  height: 54px;
  border-radius: 50%;
}


.action-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.profile-action-button::before {
  display: none !important;
  content: none !important;
}

.professional-media img,
.single-professional .af-media-thumb img,
.professional-card .account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.service-name-with-emoji {
  display: flex !important;
  min-width: 0;
  align-items: flex-start;
  gap: 7px;
}

.service-name-with-emoji > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-name-emoji {
  flex: 0 0 auto;
  font-size: 0.96em;
  line-height: 1.15;
}

.service-duration-with-emoji {
  display: inline-flex !important;
  align-items: center;
  gap: 5px;
}

.service-duration-emoji {
  flex: 0 0 auto;
  font-size: 0.86em;
  line-height: 1;
}

.favorite-button:active {
  transform: scale(0.985);
}

.favorite-button.active .favorite-icon {
  animation: af-favorite-pop 280ms ease;
}

@keyframes af-favorite-pop {
  0% {
    transform: scale(0.78);
  }

  55% {
    transform: scale(1.2);
  }

  100% {
    transform: scale(1);
  }
}

.profile-location {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.profile-meta .profile-location-emoji {
  display: inline;
  padding: 0;
  border-radius: 0;
  background: transparent;
  line-height: 1;
}

.service-choice-media .af-media-fallback {
  font-size: 1.55rem;
}

.time-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.time-selected-check {
  font-size: 0.92em;
  font-weight: 950;
  line-height: 1;
}

.time-button.selected,
.time-button[aria-pressed="true"] {
  color: #ffffff;
  border-color: var(--pink-600);
  background: var(--pink-600);
  box-shadow: 0 8px 18px rgb(197 36 107 / 18%);
}

a:focus-visible,
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid rgb(197 36 107 / 32%);
  outline-offset: 3px;
}

.data-refresh-status {
  margin: -8px 0 16px;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 700;
}

/* Sprint 6: estados de paginação e rotas públicas */
.load-more-row {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.inline-error {
  color: var(--danger, #a3214f);
  margin: 16px auto 0;
  text-align: center;
}

.link-button {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 0;
  text-decoration: underline;
}

.route-loading,
.not-found-page {
  padding-block: clamp(48px, 10vw, 112px);
}

.not-found-page {
  max-width: 680px;
  text-align: center;
}

.not-found-page .button {
  margin-top: 16px;
}

/* Sprint 23: identidade de progresso, especialidades e perfil do negócio */
.brand-progress-mark {
  width: 74px;
  height: 74px;
  overflow: visible;
  filter: drop-shadow(0 8px 14px rgb(217 47 127 / 11%));
}

.brand-progress-piece {
  fill: #f8e9ef;
  stroke: #b06b86;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: fill 220ms ease, stroke 220ms ease;
}

.brand-progress-piece.active {
  fill: var(--pink-500);
  stroke: var(--wine);
}

.brand-progress-nail {
  fill: #fff;
  pointer-events: none;
}

.flow-progress {
  display: grid;
  justify-items: center;
  gap: 10px;
}

.flow-progress > p {
  width: 100%;
}

.flow-steps {
  width: 100%;
  grid-template-columns: repeat(var(--flow-step-count, 4), minmax(0, 1fr));
}

.flow-steps li.done > span {
  color: var(--wine);
  border-color: var(--pink-500);
  background: var(--pink-100);
}

.profile-specialties {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 3px 0 10px;
}

.profile-specialties span {
  border: 1px solid var(--pink-100);
  border-radius: 999px;
  padding: 5px 10px;
  color: var(--wine);
  background: #fff8fb;
  font-size: .78rem;
  font-weight: 800;
}

.success-brand-mark {
  width: 86px;
  height: 86px;
  margin: 0 auto 18px;
}

.publication-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.business-settings-form {
  gap: 0;
  min-width: 0;
  padding-bottom: 0;
}

.business-form-section {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(190px, .42fr) minmax(0, 1fr);
  gap: clamp(20px, 4vw, 46px);
  padding-block: 28px;
}

.business-form-section > *,
.business-form-section .form-grid,
.business-form-section .field-wide {
  min-width: 0;
}

.business-form-section:first-child {
  padding-top: 0;
}

.business-form-section + .business-form-section {
  border-top: 1px solid var(--line);
}

.business-form-heading h2 {
  margin-bottom: 7px;
  font-size: 1.25rem;
}

.business-form-heading p:last-child {
  margin-bottom: 0;
  color: var(--muted);
  font-size: .88rem;
  line-height: 1.5;
}

.business-photo-editor {
  display: flex;
  align-items: center;
  gap: 18px;
}

.business-photo-editor > div {
  display: grid;
  justify-items: start;
  gap: 8px;
}

.business-photo-editor small {
  color: var(--muted);
  font-size: .8rem;
}

.public-address-hint,
.public-address-hint strong {
  overflow-wrap: anywhere;
}

.business-photo-preview {
  width: 118px;
  height: 118px;
  flex: 0 0 auto;
  border: 1px solid var(--pink-100);
  border-radius: 24px;
  background: var(--pink-50);
  font-size: 2.6rem;
}

.business-photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.specialty-field {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.specialty-field legend {
  color: var(--wine);
  font-size: .9rem;
  font-weight: 800;
}

.specialty-field > p {
  margin: 6px 0 11px;
  color: var(--muted);
  font-size: .82rem;
}

.specialty-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.specialty-option {
  display: inline-flex !important;
  min-height: 42px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 15px;
  color: var(--wine);
  background: #fff;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
}

.specialty-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}

.specialty-option.selected {
  color: #fff;
  border-color: var(--pink-600);
  background: var(--pink-600);
}

.specialty-option:has(input:focus-visible) {
  outline: 3px solid rgb(197 36 107 / 32%);
  outline-offset: 3px;
}

.business-save-actions {
  margin-inline: calc(clamp(20px, 3vw, 28px) * -1);
  border-top: 1px solid var(--line);
  padding: 18px clamp(20px, 3vw, 28px);
  background: #fff;
}
