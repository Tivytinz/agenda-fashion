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

const STEPS = [
  {
    number: "01",
    emoji: "💖",
    title: "Crie sua agenda grátis",
    description:
      "Faça seu cadastro profissional e comece sem precisar informar cartão."
  },
  {
    number: "02",
    emoji: "💅",
    title: "Configure seu negócio",
    description:
      "Adicione serviços, horários de atendimento e as informações que seus clientes precisam ver."
  },
  {
    number: "03",
    emoji: "📲",
    title: "Divulgue seu perfil",
    description:
      "Compartilhe seu endereço público para clientes conhecerem seus serviços e horários."
  },
  {
    number: "04",
    emoji: "🎉",
    title: "Receba os agendamentos",
    description:
      "O cliente agenda online e o Agenda Fashion avisa o profissional ou negócio pelo WhatsApp."
  }
];

const SPECIALTIES = [
  { emoji: "💅", label: "Manicure" },
  { emoji: "💇‍♀️", label: "Cabeleireira" },
  { emoji: "👁️", label: "Lash designer" },
  { emoji: "✨", label: "Sobrancelhas" },
  { emoji: "🌸", label: "Estética" },
  { emoji: "💄", label: "Maquiagem" }
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
      "Agenda online grátis para profissionais da beleza. Divulgue seus serviços, deixe clientes agendarem sozinhos e receba avisos pelo WhatsApp."
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

  return (
    <main className="professional-landing">
      <section className="professional-hero">
        <div className="container professional-hero-grid">
          <div className="professional-hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">✨</span>{" "}
              Agenda online grátis para profissionais da beleza
            </p>

            <h1>
              Receba agendamentos sem precisar responder cada cliente.
            </h1>

            <p className="professional-lead">
              Crie sua agenda grátis, divulgue seus serviços e deixe clientes escolherem data e horário sozinhos. Quando entrar um novo agendamento, o Agenda Fashion avisa você pelo WhatsApp.
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
                href="#como-funciona"
              >
                Ver como funciona
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
                <span>Perfil público para divulgação</span>
              </li>
              <li>
                <span aria-hidden="true">🔔</span>
                <span>Aviso de novo agendamento pelo WhatsApp</span>
              </li>
            </ul>
          </div>

          <div className="professional-product-preview" aria-label="Exemplo visual da agenda profissional">
            <div className="professional-preview-topbar">
              <div>
                <small>Agenda Fashion</small>
                <strong>Minha agenda</strong>
              </div>
              <img
                alt="Logotipo do Agenda Fashion"
                className="professional-preview-logo"
                height="46"
                src={afLogoTransparent}
                width="46"
              />
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
              <span aria-hidden="true">◉</span>
              <div>
                <strong>Novo agendamento</strong>
                <p>
                  O Agenda Fashion avisou você pelo WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="free-plan-title"
        className="professional-free-plan"
      >
        <div className="container professional-free-plan-content">
          <div>
            <p className="eyebrow">Comece sem custo</p>
            <h2 id="free-plan-title">
              Existe um plano grátis para colocar sua agenda online.
            </h2>
            <p>
              Crie seu perfil, configure seus serviços e teste o fluxo de agendamento antes de escolher mais capacidade.
            </p>
          </div>

          <Link
            className="text-link professional-plan-link"
            to="/planos"
          >
            Ver planos e limites
          </Link>
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

      <section
        aria-labelledby="growth-title"
        className="professional-growth-section"
      >
        <div className="container professional-section">
          <div className="professional-growth-heading">
            <div>
              <p className="eyebrow">Presença e crescimento</p>
              <h2 id="growth-title">
                Um perfil para divulgar. Um dashboard para acompanhar o negócio.
              </h2>
            </div>
            <p>
              O perfil público ajuda clientes a conhecer e agendar seus serviços. No painel, você acompanha os dados que mostram como o negócio está evoluindo.
            </p>
          </div>

          <div className="professional-growth-grid">
            <article className="professional-profile-demo">
              <div className="professional-demo-label">
                <span aria-hidden="true">⌁</span>
                <div>
                  <small>Seu perfil de negócio</small>
                  <strong>Pronto para divulgar</strong>
                </div>
              </div>

              <div className="professional-profile-cover" aria-hidden="true">
                AF
              </div>

              <div className="professional-profile-copy">
                <div>
                  <h3>Studio de beleza</h3>
                  <p>Serviços, preços, localização e horários em um só endereço.</p>
                </div>
                <span>Perfil público</span>
              </div>

              <div className="professional-profile-services">
                <div>
                  <span>Manicure</span>
                  <strong>Ver horários</strong>
                </div>
                <div>
                  <span>Design de sobrancelhas</span>
                  <strong>Ver horários</strong>
                </div>
              </div>
            </article>

            <article className="professional-dashboard-demo">
              <div className="professional-demo-label">
                <span aria-hidden="true">↗</span>
                <div>
                  <small>Seu dashboard</small>
                  <strong>Acompanhe a evolução do negócio</strong>
                </div>
              </div>

              <div
                aria-label="Exemplo ilustrativo dos indicadores do dashboard"
                className="professional-dashboard-metrics"
              >
                <div>
                  <span>Agendamentos</span>
                  <strong>24</strong>
                  <small>no período</small>
                </div>
                <div>
                  <span>Faturamento</span>
                  <strong>R$ 1.280</strong>
                  <small>previsto</small>
                </div>
                <div>
                  <span>Clientes novos</span>
                  <strong>8</strong>
                  <small>descobriram você</small>
                </div>
                <div>
                  <span>Conversão</span>
                  <strong>12%</strong>
                  <small>das visitas</small>
                </div>
              </div>

              <p className="professional-demo-disclaimer">
                Dados ilustrativos. O painel real usa os resultados do seu negócio.
              </p>

              <ul className="professional-dashboard-signals">
                <li>Visitas ao perfil</li>
                <li>Cliques no WhatsApp e no mapa</li>
                <li>Favoritos recebidos</li>
                <li>Serviços mais agendados</li>
              </ul>
            </article>
          </div>

          <div className="professional-growth-cta">
            <p>
              Divulgue seu negócio e acompanhe o que está trazendo resultado.
            </p>
            <Link
              className="button professional-primary-cta"
              onClick={() => trackCta("growth")}
              to={signupPath}
            >
              Criar meu perfil grátis
            </Link>
          </div>
        </div>
      </section>

      <section className="professional-soft-section" id="como-funciona">
        <div className="container professional-section">
          <div className="professional-section-heading centered">
            <p className="eyebrow">Comece em poucos passos</p>
            <h2>Do cadastro grátis ao aviso de novo agendamento</h2>
          </div>

          <ol className="professional-steps">
            {STEPS.map((step) => (
              <li key={step.number}>
                <span className="professional-step-marker">
                  <span aria-hidden="true">{step.emoji}</span>
                  <small>{step.number}</small>
                </span>
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
        <div>
          <p className="eyebrow">Comece grátis</p>
          <h2 id="professional-final-title">
            Deixe seus clientes agendarem enquanto você cuida dos atendimentos.
          </h2>
        </div>

        <Link
          className="button professional-primary-cta"
          to={signupPath}
          onClick={() => trackCta("final")}
        >
          Criar minha agenda grátis
        </Link>
      </section>
    </main>
  );
}
