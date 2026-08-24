import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { track } from "../analytics/track";
import afLogoTransparent from "../assets/brand/af-logo-transparent.png";
import "../styles/professional-landing.css";

export const PROFESSIONAL_TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "ttclid",
  "epik",
  "af_source",
  "af_medium",
  "af_content"
];

export function buildProfessionalSignupPath(search = "") {
  const incoming = new URLSearchParams(
    String(search || "").replace(/^\?/, "")
  );
  const outgoing = new URLSearchParams({
    tipo: "profissional"
  });

  for (const key of PROFESSIONAL_TRACKING_PARAMS) {
    const value = incoming.get(key)?.trim();

    if (value) {
      outgoing.set(key, value);
    }
  }

  return `/cadastro?${outgoing.toString()}`;
}

const BENEFITS = [
  {
    icon: "📅",
    title: "Cliente agenda sozinho",
    description:
      "Seu cliente escolhe serviço, data e horário disponíveis sem depender de uma conversa para marcar."
  },
  {
    icon: "🔔",
    title: "Aviso pelo WhatsApp",
    description:
      "Quando um novo agendamento é realizado, o Agenda Fashion envia um aviso ao WhatsApp do profissional ou do negócio."
  },
  {
    icon: "✨",
    title: "Perfil para conquistar clientes",
    description:
      "Divulgue serviços, preços e horários em um perfil público que ajuda novas clientes a conhecer seu trabalho."
  },
  {
    icon: "🗓️",
    title: "Rotina organizada",
    description:
      "Centralize serviços, disponibilidade e agendamentos para saber com clareza como está o seu dia."
  }
];

const SPECIALTIES = [
  { emoji: "💅", label: "Nail designer" },
  { emoji: "👁️", label: "Lash designer" },
  { emoji: "✨", label: "Designer de sobrancelhas" },
  { emoji: "🌸", label: "Estética" },
  { emoji: "💇‍♀️", label: "Cabeleireira" },
  { emoji: "💄", label: "Maquiagem" }
];

const BEAUTY_VANESSA_PROFILE = {
  path: "/negocio/beauty-vanessa"
};

const REAL_BOOKING_STEPS = [
  {
    number: "1",
    icon: "🔗",
    title: "Você divulga seu perfil",
    description:
      "Compartilhe o link do Agenda Fashion no Instagram, na bio ou pelo WhatsApp."
  },
  {
    number: "2",
    icon: "💅",
    title: "A cliente escolhe o serviço",
    description:
      "No perfil da Beauty Vanessa, ela encontra Design + Henna, com duração de 60 minutos e valor de R$ 40,00."
  },
  {
    number: "3",
    icon: "📅",
    title: "Seleciona um horário livre",
    description:
      "A agenda mostra somente os dias e horários que a Vanessa deixou disponíveis."
  },
  {
    number: "4",
    icon: "✅",
    title: "Confirma o agendamento",
    description:
      "A cliente informa nome e WhatsApp, confere os dados e conclui sem instalar aplicativo."
  }
];

const FAQ = [
  {
    question: "O Agenda Fashion é grátis?",
    answer:
      "Sim. Existe um plano grátis para começar. Se precisar de mais capacidade conforme sua agenda crescer, você pode comparar os demais planos antes de decidir."
  },
  {
    question: "Preciso cadastrar cartão para começar?",
    answer:
      "Não. Você pode criar sua conta profissional e começar no plano grátis sem informar cartão."
  },
  {
    question: "Vou receber os agendamentos pelo WhatsApp?",
    answer:
      "Quando um novo agendamento é realizado, o Agenda Fashion envia um aviso ao WhatsApp cadastrado pelo profissional ou negócio."
  },
  {
    question: "Preciso ter salão para usar?",
    answer:
      "Não. O Agenda Fashion atende profissionais autônomos e também negócios com equipe."
  },
  {
    question: "Meu cliente precisa instalar um aplicativo?",
    answer:
      "Não. O fluxo de descoberta e agendamento funciona pela web, direto no navegador."
  },
  {
    question: "Como o cliente marca um horário?",
    answer:
      "Pelo seu perfil público, o cliente escolhe o serviço, a data e um horário disponível diretamente no navegador."
  }
];

function WhatsAppIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2a9.5 9.5 0 0 0-8.16 14.38L2.5 21.5l5.25-1.38A9.5 9.5 0 1 0 12 2Zm0 17.25a7.7 7.7 0 0 1-3.92-1.06l-.28-.17-3.12.82.83-3.04-.18-.29A7.75 7.75 0 1 1 12 19.25Zm4.25-5.78c-.23-.12-1.38-.68-1.59-.76-.21-.08-.36-.12-.52.12-.15.23-.59.76-.73.91-.13.16-.27.18-.5.06-.23-.12-.98-.36-1.86-1.15-.69-.61-1.15-1.37-1.28-1.6-.14-.23-.02-.36.1-.48.11-.1.23-.27.35-.41.12-.13.16-.23.23-.39.08-.15.04-.29-.02-.41-.06-.12-.52-1.25-.71-1.71-.18-.45-.37-.39-.51-.4h-.44c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.91s.82 2.22.94 2.37c.12.16 1.62 2.48 3.93 3.48.55.24.98.38 1.31.49.55.17 1.05.15 1.45.09.44-.07 1.38-.56 1.57-1.1.2-.55.2-1.02.14-1.11-.06-.1-.21-.16-.44-.27Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ensureMetaDescription(content) {
  let element = document.querySelector('meta[name="description"]');
  const created = !element;

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", "description");
    document.head.appendChild(element);
  }

  const previous = element.getAttribute("content");
  element.setAttribute("content", content);

  return () => {
    if (created) {
      element.remove();
      return;
    }

    if (previous === null) {
      element.removeAttribute("content");
    } else {
      element.setAttribute("content", previous);
    }
  };
}

export function ProfessionalLandingPage() {
  const location = useLocation();
  const signupPath = buildProfessionalSignupPath(
    location.search
  );

  useEffect(() => {
    const previousTitle = document.title;
    const restoreDescription = ensureMetaDescription(
      "Agenda online grátis para nail designers, lash designers, designers de sobrancelhas, manicures, esteticistas e salões. Receba agendamentos e avisos pelo WhatsApp."
    );

    document.title =
      "Agenda online grátis para profissionais | Agenda Fashion";

    track("landing_profissionais_visualizada", {
      page: "para_profissionais",
      mission: "adquirir_profissional"
    });

    return () => {
      document.title = previousTitle;
      restoreDescription();
    };
  }, []);

  function trackCta(position) {
    track("landing_profissionais_cta_clicado", {
      page: "para_profissionais",
      mission: "adquirir_profissional",
      properties: {
        posicao: position
      }
    });
  }

  function trackDemo() {
    track("landing_profissionais_demo_clicada", {
      page: "para_profissionais",
      mission: "adquirir_profissional",
      properties: {
        negocio: "beauty-vanessa"
      }
    });
  }

  return (
    <main className="professional-landing">
      <section className="professional-hero">
        <div className="container professional-hero-grid">
          <div className="professional-hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">✨</span>{" "}
              Para nail, lash, sobrancelhas, estética e salões
            </p>

            <h1>
              Sua cliente agenda. Você atende. O AF organiza e avisa.
            </h1>

            <p className="professional-lead">
              Feito para nail designers, lash designers, designers de sobrancelhas, manicures, esteticistas e salões. Publique seus serviços e deixe a cliente escolher data e horário enquanto você atende. Quando o agendamento entrar, o{" "}
              <span className="professional-brand-inline">
                <img
                  alt=""
                  height="22"
                  src={afLogoTransparent}
                  width="22"
                />
                Agenda Fashion
              </span>{" "}
              avisa você pelo{" "}
              <span className="professional-whatsapp-inline">
                <WhatsAppIcon className="professional-whatsapp-inline-icon" />
                WhatsApp
              </span>.
            </p>

            <div className="professional-hero-actions">
              <Link
                className="button professional-primary-cta"
                to={signupPath}
                onClick={() => trackCta("hero")}
              >
                Criar minha agenda grátis
              </Link>

              <a
                className="button button-secondary"
                href="#demonstracao-real"
              >
                Ver demonstração real
              </a>
            </div>

            <ul className="professional-trust-list" aria-label="Principais benefícios">
              <li>
                <span aria-hidden="true">🆓</span>
                <span>Plano grátis para começar</span>
              </li>
              <li>
                <span aria-hidden="true">📅</span>
                <span>Cliente agenda sozinho</span>
              </li>
              <li>
                <span aria-hidden="true">💖</span>
                <span>Feito para autônomas e salões</span>
              </li>
              <li>
                <span aria-hidden="true">🔔</span>
                <span>Aviso de novo agendamento pelo WhatsApp</span>
              </li>
            </ul>
          </div>

          <div
            aria-label="Exemplo do aviso de novo agendamento no WhatsApp"
            className="professional-product-preview professional-whatsapp-preview"
          >
            <div className="professional-whatsapp-topbar">
              <span className="professional-whatsapp-avatar">
                <img
                  alt="Foto de perfil do Agenda Fashion"
                  className="professional-whatsapp-avatar-image"
                  height="42"
                  src={afLogoTransparent}
                  width="42"
                />
              </span>
              <div>
                <small>WhatsApp</small>
                <strong>Agenda Fashion</strong>
              </div>
              <span className="professional-whatsapp-now">agora</span>
            </div>

            <div className="professional-whatsapp-chat">
              <div className="professional-whatsapp-bubble">
                <p>Olá! Um novo agendamento foi realizado. ✨</p>
                <dl>
                  <div>
                    <dt>👤 Cliente</dt>
                    <dd>Maria Oliveira</dd>
                  </div>
                  <div>
                    <dt>💅 Serviço</dt>
                    <dd>Design + Henna</dd>
                  </div>
                  <div>
                    <dt>👩 Profissional</dt>
                    <dd>Vanessa</dd>
                  </div>
                  <div>
                    <dt>📅 Data</dt>
                    <dd>19/08/2026</dd>
                  </div>
                  <div>
                    <dt>⏰ Horário</dt>
                    <dd>19:00</dd>
                  </div>
                </dl>
                <p>💖 Abra o Agenda Fashion para conferir.</p>
                <small>16:32 <span aria-label="Mensagem entregue">✓✓</span></small>
              </div>
            </div>

            <div className="professional-whatsapp-status">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Aviso automático entregue</strong>
                <p>Você atende. O Agenda Fashion organiza e avisa.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="real-demo-title"
        className="professional-real-demo"
        id="demonstracao-real"
      >
        <div className="container professional-section">
          <div className="professional-real-demo-heading">
            <div>
              <p className="eyebrow">Passo a passo real</p>
              <h2 id="real-demo-title">
                Veja o Design + Henna da Beauty Vanessa sendo agendado até o aviso no WhatsApp.
              </h2>
            </div>
            <p>
              Um exemplo real e direto: a cliente escolhe o serviço, encontra um horário livre e confirma sem precisar chamar a profissional para marcar.
            </p>
          </div>

          <div className="professional-real-service-proof">
            <div>
              <span aria-hidden="true">💅</span>
              <p>
                <small>Serviço real escolhido</small>
                <strong>Design + Henna</strong>
              </p>
            </div>
            <dl>
              <div>
                <dt>Profissional</dt>
                <dd>Vanessa</dd>
              </div>
              <div>
                <dt>Duração</dt>
                <dd>60 min</dd>
              </div>
              <div>
                <dt>Valor</dt>
                <dd>R$ 40,00</dd>
              </div>
            </dl>
            <Link
              className="button button-secondary"
              onClick={trackDemo}
              to={BEAUTY_VANESSA_PROFILE.path}
            >
              Testar no perfil real ↗
            </Link>
          </div>

          <ol className="professional-demo-step-grid">
            {REAL_BOOKING_STEPS.map((step) => (
              <li key={step.number}>
                <div className="professional-demo-step-topline">
                  <span>{step.number}</span>
                  <span aria-hidden="true">{step.icon}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>

          <article className="professional-demo-final-notification">
            <div className="professional-demo-final-copy">
              <span>5</span>
              <div>
                <small>Resultado automático</small>
                <h3>O AF envia o novo agendamento para a Vanessa no WhatsApp</h3>
                <p>Ela recebe cliente, serviço, data e horário sem interromper o atendimento para conferir a agenda.</p>
              </div>
            </div>
            <div className="professional-demo-final-message">
              <img alt="Agenda Fashion" height="42" src={afLogoTransparent} width="42" />
              <p>
                <strong>✨ Novo agendamento</strong>
                <span>💅 Design + Henna · Vanessa</span>
                <span>📅 19/08/2026 às 19:00</span>
              </p>
              <WhatsAppIcon className="professional-booking-result-icon" />
            </div>
          </article>

          <div className="professional-real-demo-cta">
            <div>
              <strong>Quer esse fluxo funcionando no seu negócio?</strong>
              <small>Comece no plano grátis, sem cartão e sem instalar aplicativo.</small>
            </div>
            <div>
              <Link
                className="button professional-primary-cta"
                onClick={() => trackCta("real_demo")}
                to={signupPath}
              >
                Criar minha agenda grátis
              </Link>
              <Link className="text-link" to="/planos">
                Ver planos e limites
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container professional-section" aria-labelledby="benefits-title">
        <div className="professional-section-heading">
          <p className="eyebrow">Mais tempo para atender</p>
          <h2 id="benefits-title">
            O cliente encontra, escolhe e agenda pelo próprio perfil
          </h2>
          <p>
            Você configura o que oferece e quando atende. O Agenda Fashion transforma essas informações em um caminho simples para o cliente marcar.
          </p>
        </div>

        <div className="professional-benefit-grid">
          {BENEFITS.map((benefit) => (
            <article className="professional-benefit-card" key={benefit.title}>
              <span className="professional-benefit-icon" aria-hidden="true">
                {benefit.icon}
              </span>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container professional-section professional-audience-section">
        <div className="professional-audience-copy">
          <p className="eyebrow">Sua especialidade já cabe aqui</p>
          <h2>Para profissionais autônomas, studios e salões de beleza</h2>
          <p>
            Seja nail, lash, sobrancelhas, estética, cabelo ou maquiagem: você configura seus próprios serviços, valores e horários.
          </p>
        </div>

        <div className="professional-specialties" aria-label="Exemplos de especialidades">
          {SPECIALTIES.map((specialty) => (
            <span key={specialty.label}>
              <span aria-hidden="true">{specialty.emoji}</span>
              {specialty.label}
            </span>
          ))}
        </div>
      </section>

      <section className="professional-soft-section">
        <div className="container professional-section professional-faq-layout">
          <div className="professional-faq-intro">
            <p className="eyebrow">Dúvidas comuns</p>
            <h2>Saiba exatamente como começar</h2>
            <p>
              Preço, funcionamento do agendamento e avisos explicados antes do cadastro.
            </p>
          </div>

          <div className="professional-faq-list">
            {FAQ.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container professional-final-cta" aria-labelledby="professional-final-title">
        <div className="professional-final-copy">
          <p className="eyebrow">Comece grátis</p>
          <h2 id="professional-final-title">
            Deixe seus clientes agendarem enquanto você cuida dos atendimentos.
          </h2>
          <p className="professional-final-lead">
            Crie seu perfil, publique os serviços e compartilhe seu link. O cliente escolhe o horário e você recebe o aviso pelo WhatsApp.
          </p>
          <ul className="professional-final-benefits">
            <li><span aria-hidden="true">🆓</span> Plano grátis</li>
            <li><span aria-hidden="true">📲</span> Sem aplicativo</li>
            <li><span aria-hidden="true">💖</span> Feito para beleza</li>
          </ul>
        </div>

        <div className="professional-final-actions">
          <Link
            className="button professional-primary-cta"
            to={signupPath}
            onClick={() => trackCta("final")}
          >
            Criar minha agenda grátis
          </Link>
          <small>Sem cartão para começar.</small>
        </div>
      </section>
    </main>
  );
}
