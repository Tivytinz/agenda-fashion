import {
  useEffect,
  useState
} from "react";
import { Link } from "react-router-dom";
import {
  clearGoogleCookies,
  getGoogleConfig,
  initializeGoogleMeasurement,
  syncGoogleConsent,
  updateGoogleConsent
} from "../analytics/googleMeasurement";
import {
  getMarketingConsent,
  MARKETING_CONSENT,
  MARKETING_CONSENT_EVENT,
  setMarketingConsent
} from "../analytics/marketingConsent";
import {
  clearMarketingAttribution
} from "../analytics/track";
import {
  clearMetaCookies,
  getMetaConfig,
  initializeMetaAds,
  syncMetaConsent
} from "../analytics/metaAds";
import {
  GOOGLE_BUSINESS_DATA_URL,
  LEGAL_CONTACT_EMAIL,
  PRIVACY_NOTICE_VERSION
} from "../config/legal";

function statusLabel(status) {
  if (status === MARKETING_CONSENT.GRANTED) {
    return "Permitida";
  }

  if (status === MARKETING_CONSENT.DENIED) {
    return "Não permitida";
  }

  return "Ainda não escolhida";
}

export function PrivacyPage() {
  const [metaConfig, setMetaConfig] = useState(null);
  const [googleConfig, setGoogleConfig] = useState(null);
  const [consent, setConsent] = useState(getMarketingConsent);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacidade e cookies | Agenda Fashion";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    Promise.all([
      getMetaConfig(),
      getGoogleConfig()
    ]).then(([nextMetaConfig, nextGoogleConfig]) => {
      setMetaConfig(nextMetaConfig);
      setGoogleConfig(nextGoogleConfig);
    });
  }, []);

  useEffect(() => {
    function handleConsent(event) {
      setConsent(
        event.detail?.status || getMarketingConsent()
      );
    }

    window.addEventListener(
      MARKETING_CONSENT_EVENT,
      handleConsent
    );

    return () => window.removeEventListener(
      MARKETING_CONSENT_EVENT,
      handleConsent
    );
  }, []);

  async function choose(status) {
    setSyncError("");
    setMarketingConsent(status);
    setConsent(status);

    if (status === MARKETING_CONSENT.GRANTED) {
      await Promise.all([
        metaConfig?.enabled
          ? initializeMetaAds().catch(() => false)
          : Promise.resolve(false),
        googleConfig?.enabled
          ? initializeGoogleMeasurement().catch(() => false)
          : Promise.resolve(false)
      ]);
    } else {
      clearMarketingAttribution();

      if (metaConfig?.enabled) {
        clearMetaCookies();
      }

      if (googleConfig?.enabled) {
        clearGoogleCookies();
        updateGoogleConsent(MARKETING_CONSENT.DENIED);
      }
    }

    const resultados = await Promise.allSettled([
      metaConfig?.enabled
        ? syncMetaConsent()
        : Promise.resolve(false),
      googleConfig?.enabled ||
        status === MARKETING_CONSENT.DENIED
        ? syncGoogleConsent()
        : Promise.resolve(false)
    ]);

    if (
      resultados.some(
        (resultado) => resultado.status === "rejected"
      )
    ) {
      setSyncError(
        "A escolha já vale neste navegador, mas não foi possível sincronizá-la com sua conta. O Agenda Fashion tentará novamente quando a conexão voltar."
      );
    }
  }

  const measurementEnabled = Boolean(
    metaConfig?.enabled || googleConfig?.enabled
  );

  return (
    <main className="container page-content narrow-page privacy-page legal-page">
      <Link className="back-link" to="/">
        ← Voltar ao Agenda Fashion
      </Link>

      <header className="workspace-heading legal-heading">
        <div>
          <p className="eyebrow">Seus dados, sua escolha</p>
          <h1>Política de Privacidade e Cookies</h1>
          <p>
            Esta política explica quais dados o Agenda Fashion trata, por que eles são necessários, com quem podem ser compartilhados e como você controla suas escolhas.
          </p>
          <small>Versão vigente: {PRIVACY_NOTICE_VERSION}</small>
        </div>
      </header>

      <section className="panel privacy-section legal-section">
        <h2>1. Controlador e contato</h2>
        <p>
          O Agenda Fashion é o controlador dos dados tratados para operar esta plataforma. Solicitações de privacidade, exercício de direitos e dúvidas podem ser enviadas para <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>2. Dados tratados</h2>
        <ul>
          <li>Conta: nome, e-mail, WhatsApp, credenciais protegidas e preferências.</li>
          <li>Negócio: perfil, serviços, preços, imagens, equipe, cidade, agenda e disponibilidade.</li>
          <li>Agendamentos: cliente, telefone, serviço, profissional, data, horário e status.</li>
          <li>Pagamento: plano, valor, status e identificadores da transação. O processamento do PIX é realizado pelo Asaas.</li>
          <li>Segurança e operação: sessão, endereço IP, registros técnicos, dispositivo e eventos necessários para prevenir abuso e diagnosticar falhas.</li>
          <li>Aquisição opcional: origem da campanha, identificadores de clique e identificador pseudônimo do Google Analytics, somente quando houver autorização para medição de marketing.</li>
        </ul>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>3. Finalidades e bases legais</h2>
        <ul>
          <li>Executar os <Link to="/termos">Termos de uso</Link>, criar contas, publicar perfis, organizar horários, concluir agendamentos e administrar planos.</li>
          <li>Cumprir obrigações legais, fiscais, consumeristas e responder a autoridades competentes.</li>
          <li>Proteger contas, prevenir fraude, manter logs essenciais e melhorar a confiabilidade com base no legítimo interesse, respeitando os direitos das pessoas.</li>
          <li>Enviar comunicações pelo WhatsApp e ativar Google Analytics, Google Ads ou Meta somente nas finalidades opcionais que dependem de consentimento.</li>
        </ul>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>4. Cookies, armazenamento e medição opcional</h2>
        <p>
          Sessão, segurança, preferências e continuidade dos fluxos usam cookies ou armazenamento local necessários para o serviço. Eles não ativam publicidade personalizada.
        </p>
        <p>
          Se você permitir, Google Analytics, Google Ads e Meta podem medir visitas, cadastros profissionais, início de checkout e a primeira ativação de assinatura. Isso pode incluir identificadores pseudônimos de navegador e clique, dados do dispositivo, região aproximada e interações. Quanto à navegação, o Google recebe somente rotas genéricas do AF; parâmetros de busca, tokens, e-mails, telefones e nomes presentes em URLs não são enviados pela implementação do Agenda Fashion.
        </p>
        <p>
          A atribuição de campanhas guardada pelo AF expira no navegador em até 30 dias. Ao negar ou retirar a autorização, os identificadores e a atribuição opcional controlados pelo AF são removidos do navegador e da conta e deixam de acompanhar novos eventos. O histórico mínimo da escolha é mantido para comprovar e respeitar a revogação.
        </p>
        <p>
          Saiba <a href={GOOGLE_BUSINESS_DATA_URL} rel="noreferrer" target="_blank">como o Google usa dados de sites e aplicativos</a>. O AF mantém os sinais de personalização de anúncios do Google desativados e usa a integração para medição. A configuração defensiva de redação do GA4 deve permanecer ativa como proteção adicional; ela não substitui os controles do AF.
        </p>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>5. WhatsApp</h2>
        <p>
          Mensagens automáticas pelo WhatsApp exigem autorização clara. Avisos operacionais de agendamentos e orientações de marketing são escolhas separadas. Clientes podem agendar sem autorizar mensagens.
        </p>
        <p>
          Profissionais podem alterar preferências em Minha conta. PARAR MARKETING interrompe essa categoria; SAIR, PARAR ou STOP interrompem todas as mensagens automáticas para o número. O AF registra finalidade, origem, data e telefone da autorização ou do cancelamento para respeitar e comprovar a escolha.
        </p>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>6. Compartilhamento e transferências</h2>
        <p>
          Dados podem ser tratados por fornecedores de hospedagem, banco de dados, imagens, e-mail, segurança, pagamento, Google, Meta e WhatsApp, somente na medida necessária à finalidade contratada. Alguns fornecedores podem processar dados fora do Brasil e devem aplicar medidas contratuais e técnicas adequadas de proteção.
        </p>
        <p>
          O Agenda Fashion não vende dados pessoais. Informações também podem ser compartilhadas para cumprir obrigação legal, ordem válida ou proteger direitos e segurança.
        </p>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>7. Retenção e segurança</h2>
        <p>
          Os dados permanecem pelo tempo necessário para prestar o serviço, cumprir obrigações legais, prevenir fraude e exercer direitos. Depois disso, são eliminados ou anonimizados quando possível. Registros financeiros e jurídicos podem ser mantidos pelos prazos legais aplicáveis.
        </p>
        <p>
          O AF usa HTTPS, credenciais protegidas, cookie de sessão HttpOnly, controle de acesso, isolamento entre negócios e registros de segurança. Nenhum sistema é infalível; incidentes relevantes serão tratados conforme a legislação.
        </p>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>8. Seus direitos</h2>
        <p>
          Você pode solicitar confirmação e acesso, correção, informação sobre compartilhamentos, portabilidade quando aplicável, revisão, anonimização, bloqueio ou eliminação, além de revogar consentimentos. A solicitação deve ser enviada para <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Poderemos pedir dados mínimos para confirmar a identidade e proteger a conta.
        </p>
        <p>
          Também é possível apresentar reclamação à Autoridade Nacional de Proteção de Dados. A revogação não torna ilegal o tratamento realizado antes dela e pode não eliminar dados que precisam ser preservados por obrigação legal.
        </p>
      </section>

      <section className="panel privacy-section legal-section">
        <h2>9. Atualizações</h2>
        <p>
          Mudanças relevantes nesta política serão publicadas com nova data de versão. Quando a alteração exigir uma nova autorização, o Agenda Fashion apresentará novamente a escolha antes de ativar a medição opcional.
        </p>
      </section>

      <section className="panel privacy-section legal-section" id="preferencias-medicao">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Preferência atual</p>
            <h2>{statusLabel(consent)}</h2>
          </div>
        </div>

        <p>
          Esta escolha controla Google Analytics, Google Ads e Meta para medição de anúncios. Negar não impede cadastro, agendamento, uso do plano Grátis ou contratação de um plano pago.
        </p>

        {measurementEnabled ? (
          <div className="marketing-consent-actions privacy-actions">
            <button
              aria-pressed={consent === MARKETING_CONSENT.DENIED}
              className="button button-secondary"
              onClick={() => choose(MARKETING_CONSENT.DENIED)}
              type="button"
            >
              Não permitir
            </button>
            <button
              aria-pressed={consent === MARKETING_CONSENT.GRANTED}
              className="button button-secondary"
              onClick={() => choose(MARKETING_CONSENT.GRANTED)}
              type="button"
            >
              Permitir
            </button>
          </div>
        ) : (
          <>
            <p className="muted">
              As integrações opcionais de publicidade e analytics estão desativadas no Agenda Fashion neste momento.
            </p>
            {consent === MARKETING_CONSENT.GRANTED && (
              <button
                className="button button-secondary"
                onClick={() => choose(MARKETING_CONSENT.DENIED)}
                type="button"
              >
                Retirar autorização anterior
              </button>
            )}
          </>
        )}

        {syncError && (
          <p className="form-error privacy-sync-message" role="alert">
            {syncError}
          </p>
        )}
      </section>
    </main>
  );
}
