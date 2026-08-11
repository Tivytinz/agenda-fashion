import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { track } from "../analytics/track";
import "../styles/professional-landing.css";

export const PROFESSIONAL_TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid"
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
    icon: "◷",
    title: "Agenda online organizada",
    description:
      "Centralize seus horários e deixe mais claro quando você está disponível para atender."
  },
  {
    icon: "✦",
    title: "Serviços em um só lugar",
    description:
      "Cadastre seus serviços, preços e informações para apresentar seu trabalho de forma simples."
  },
  {
    icon: "⌁",
    title: "Página para divulgar",
    description:
      "Tenha um perfil público do seu negócio para compartilhar com clientes e usar nas suas divulgações."
  },
  {
    icon: "✓",
    title: "Agendamento pelo cliente",
    description:
      "O cliente escolhe serviço, data e horário disponíveis pelo próprio Agenda Fashion."
  }
];

const STEPS = [
  {
    number: "01",
    title: "Crie sua conta profissional",
    description:
      "Faça seu cadastro e informe os dados básicos para começar."
  },
  {
    number: "02",
    title: "Configure seu negócio",
    description:
      "Adicione serviços, horários de atendimento e as informações que seus clientes precisam ver."
  },
  {
    number: "03",
    title: "Divulgue e receba agendamentos",
    description:
      "Compartilhe seu perfil e deixe seus horários disponíveis para agendamento online."
  }
];

const SPECIALTIES = [
  "Manicure",
  "Cabeleireira",
  "Lash designer",
  "Sobrancelhas",
  "Estética",
  "Maquiagem"
];

const FAQ = [
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
    question: "Consigo cadastrar meus serviços e horários?",
    answer:
      "Sim. Você pode cadastrar serviços e configurar sua disponibilidade dentro da área profissional."
  },
  {
    question: "Posso divulgar meu perfil nas redes sociais?",
    answer:
      "Sim. Depois de configurar e publicar o negócio, você pode compartilhar o link público com seus clientes."
  }
];

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
      "Agenda online para profissionais da beleza. Organize serviços e horários, divulgue seu perfil e receba agendamentos pelo Agenda Fashion."
    );

    document.title =
      "Agenda Fashion para profissionais da beleza";

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

  return (
    <main className="professional-landing">
      <section className="professional-hero">
        <div className="container professional-hero-grid">
          <div className="professional-hero-copy">
            <p className="eyebrow">
              Agenda online para profissionais da beleza
            </p>

            <h1>
              Sua agenda organizada. Seus clientes agendando online.
            </h1>

            <p className="professional-lead">
              Organize serviços e horários, divulgue seu perfil e ofereça um caminho simples para seus clientes escolherem quando querem ser atendidos.
            </p>

            <div className="professional-hero-actions">
              <Link
                className="button professional-primary-cta"
                to={signupPath}
                onClick={() => trackCta("hero")}
              >
                Criar minha conta profissional
              </Link>

              <a
                className="button button-secondary"
                href="#como-funciona"
              >
                Ver como funciona
              </a>
            </div>

            <ul className="professional-trust-list" aria-label="Principais benefícios">
              <li>Perfil público para divulgação</li>
              <li>Serviços e horários configuráveis</li>
              <li>Agendamento online pelo cliente</li>
            </ul>
          </div>

          <div className="professional-product-preview" aria-label="Exemplo visual da agenda profissional">
            <div className="professional-preview-topbar">
              <div>
                <small>Agenda Fashion</small>
                <strong>Minha agenda</strong>
              </div>
              <span aria-hidden="true">AF</span>
            </div>

            <div className="professional-preview-date">
              <span>Hoje</span>
              <strong>Agenda de atendimento</strong>
            </div>

            <div className="professional-preview-slots">
              <div className="professional-slot available">
                <strong>09:00</strong>
                <span>Horário disponível</span>
                <small>Livre</small>
              </div>
              <div className="professional-slot booked">
                <strong>10:30</strong>
                <span>Atendimento agendado</span>
                <small>Confirmado</small>
              </div>
              <div className="professional-slot available">
                <strong>14:00</strong>
                <span>Horário disponível</span>
                <small>Livre</small>
              </div>
            </div>

            <div className="professional-preview-note">
              <span aria-hidden="true">✓</span>
              <p>
                Seus serviços e horários ficam organizados no mesmo fluxo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container professional-section" aria-labelledby="benefits-title">
        <div className="professional-section-heading">
          <p className="eyebrow">Menos improviso na rotina</p>
          <h2 id="benefits-title">
            Um espaço para organizar sua presença e seus agendamentos
          </h2>
          <p>
            O Agenda Fashion conecta a parte que você configura com a experiência que o cliente usa para encontrar e agendar seus serviços.
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

      <section className="professional-soft-section" id="como-funciona">
        <div className="container professional-section">
          <div className="professional-section-heading centered">
            <p className="eyebrow">Comece em poucos passos</p>
            <h2>Do cadastro ao seu perfil pronto para divulgar</h2>
          </div>

          <ol className="professional-steps">
            {STEPS.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container professional-section professional-audience-section">
        <div className="professional-audience-copy">
          <p className="eyebrow">Feito para a rotina da beleza</p>
          <h2>Para quem atende sozinho ou está construindo um negócio</h2>
          <p>
            Você pode começar como profissional autônomo e organizar sua operação conforme o seu atendimento cresce.
          </p>
        </div>

        <div className="professional-specialties" aria-label="Exemplos de especialidades">
          {SPECIALTIES.map((specialty) => (
            <span key={specialty}>{specialty}</span>
          ))}
        </div>
      </section>

      <section className="professional-soft-section">
        <div className="container professional-section professional-faq-layout">
          <div className="professional-faq-intro">
            <p className="eyebrow">Dúvidas comuns</p>
            <h2>Antes de criar sua conta</h2>
            <p>
              O básico que você precisa saber para começar sem transformar uma ferramenta de agenda em curso preparatório.
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
        <div>
          <p className="eyebrow">Pronta para organizar sua agenda?</p>
          <h2 id="professional-final-title">
            Crie seu acesso profissional e configure seu espaço no Agenda Fashion.
          </h2>
        </div>

        <Link
          className="button professional-primary-cta"
          to={signupPath}
          onClick={() => trackCta("final")}
        >
          Começar agora
        </Link>
      </section>
    </main>
  );
}
