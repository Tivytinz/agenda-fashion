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

const BEAUTY_VANESSA_PROFILE = {
  path: "/negocio/beauty-vanessa",
  imageUrl:
    "https://res.cloudinary.com/dcuqxskee/image/upload/f_auto,q_auto,c_fill,w_640/v1785887392/saas-agendamento/negocios/fcgx1xzljdc3ww1blxr8.jpg",
  categories: ["Cílios", "Sobrancelhas", "Estética"],
  services: [
    {
      name: "Design + Henna",
      details: "60 min · R$ 40"
    },
    {
      name: "Extensão de Cílios",
      details: "120 min · R$ 100"
    },
    {
      name: "Limpeza de pele",
      details: "60 min · R$ 50"
    }
  ]
};

const REAL_BOOKING_STEPS = [
  {
    number: "1",
    icon: "🔎",
    title: "A cliente encontra o perfil",
    description:
      "Ela conhece a Beauty Vanessa, vê as especialidades e compara os serviços publicados."
  },
  {
    number: "2",
    icon: "✨",
    title: "Escolhe o serviço",
    description:
      "Design + Henna · 60 minutos · R$ 40,00. Preço e duração aparecem antes da confirmação."
  },
  {
    number: "3",
    icon: "📅",
    title: "Seleciona um horário livre",
    description:
      "A agenda mostra somente datas e horários realmente disponíveis para a Vanessa."
  },
  {
    number: "4",
    icon: "✅",
    title: "Confirma os dados",
    description:
      "A cliente informa nome e WhatsApp e conclui o agendamento sem instalar aplicativo."
  },
  {
    number: "5",
    icon: "📲",
    title: "A profissional recebe o aviso",
    description:
      "O Agenda Fashion envia pelo WhatsApp os dados do novo agendamento para conferência."
  }
];

const DASHBOARD_CAPABILITIES = [
  {
    emoji: "📅",
    title: "Agendamentos",
    description: "Compare períodos e acompanhe sua agenda."
  },
  {
    emoji: "💰",
    title: "Faturamento",
    description: "Veja o valor previsto dos atendimentos."
  },
  {
    emoji: "💖",
    title: "Clientes",
    description: "Entenda quem voltou e quem chegou agora."
  },
  {
    emoji: "📈",
    title: "Crescimento",
    description: "Descubra o que está trazendo resultado."
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
              Agenda online grátis para profissionais da beleza
            </p>

            <h1>
              Receba agendamentos sem precisar responder cada cliente.
            </h1>

            <p className="professional-lead">
              Crie sua agenda grátis, divulgue seus serviços e deixe clientes escolherem data e horário sozinhos. Quando entrar um novo agendamento, o{" "}
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
                <span>Perfil público para divulgação</span>
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
                <WhatsAppIcon className="professional-whatsapp-avatar-icon" />
              </span>
              <div>
                <small>WhatsApp</small>
                <strong>Agenda Fashion</strong>
              </div>
              <span className="professional-whatsapp-now">agora</span>
            </div>

            <div className="professional-whatsapp-chat">
              <div className="professional-whatsapp-bubble">
                <p>Olá! Um novo agendamento foi realizado.</p>
                <dl>
                  <div><dt>Cliente</dt><dd>Maria Oliveira</dd></div>
                  <div><dt>Serviço</dt><dd>Design + Henna</dd></div>
                  <div><dt>Profissional</dt><dd>Vanessa</dd></div>
                  <div><dt>Data</dt><dd>20/08/2026</dd></div>
                  <div><dt>Horário</dt><dd>14:00</dd></div>
                </dl>
                <p>Abra o Agenda Fashion para conferir.</p>
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
              <p className="eyebrow">Demonstração real</p>
              <h2 id="real-demo-title">
                Veja uma cliente agendando na Beauty Vanessa — do perfil ao aviso no WhatsApp.
              </h2>
            </div>
            <p>
              A experiência abaixo usa o perfil e os serviços reais da Beauty Vanessa no Agenda Fashion. Você pode abrir o perfil e testar os horários disponíveis.
            </p>
          </div>

          <div className="professional-real-demo-grid">
            <article className="professional-profile-demo">
              <div className="professional-demo-label">
                <span aria-hidden="true">💖</span>
                <div>
                  <small>Perfil publicado no Agenda Fashion</small>
                  <strong>Beauty Vanessa</strong>
                </div>
              </div>

              <img
                alt="Foto do perfil Beauty Vanessa"
                className="professional-profile-cover"
                height="250"
                loading="lazy"
                src={BEAUTY_VANESSA_PROFILE.imageUrl}
                width="560"
              />

              <div className="professional-profile-copy">
                <div>
                  <h3>Beauty Vanessa</h3>
                  <p>📍 Araguaia, Aparecida de Goiânia, GO</p>
                </div>
                <span>✨ Perfil real</span>
              </div>

              <div
                aria-label="Especialidades da Beauty Vanessa"
                className="professional-profile-categories"
              >
                {BEAUTY_VANESSA_PROFILE.categories.map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>

              <div className="professional-profile-services">
                {BEAUTY_VANESSA_PROFILE.services.map((service) => (
                  <div key={service.name}>
                    <span>{service.name}</span>
                    <strong>{service.details}</strong>
                  </div>
                ))}
              </div>

              <Link
                className="button button-secondary professional-profile-link"
                onClick={trackDemo}
                to={BEAUTY_VANESSA_PROFILE.path}
              >
                Testar o agendamento real ↗
              </Link>
            </article>

            <article className="professional-booking-demo">
              <div className="professional-booking-demo-topbar">
                <div>
                  <small>Fluxo completo</small>
                  <strong>Da descoberta à notificação</strong>
                </div>
                <span>Sem aplicativo</span>
              </div>

              <ol className="professional-booking-flow">
                {REAL_BOOKING_STEPS.map((step) => (
                  <li key={step.number}>
                    <span className="professional-booking-flow-marker">
                      <span aria-hidden="true">{step.icon}</span>
                      <small>{step.number}</small>
                    </span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="professional-booking-result">
                <WhatsAppIcon className="professional-booking-result-icon" />
                <div>
                  <small>Resultado para a profissional</small>
                  <strong>Novo agendamento recebido no WhatsApp</strong>
                </div>
              </div>
            </article>
          </div>

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

      <section
        aria-labelledby="growth-title"
        className="professional-growth-section"
      >
        <div className="container professional-section">
          <div className="professional-growth-heading">
            <div>
              <p className="eyebrow">Depois do agendamento</p>
              <h2 id="growth-title">
                A agenda se organiza e o dashboard mostra o crescimento do negócio.
              </h2>
            </div>
            <p>
              Cada novo agendamento deixa de ser apenas uma conversa no WhatsApp e passa a fazer parte de uma rotina que você consegue acompanhar.
            </p>
          </div>

          <div className="professional-growth-grid">
            <article className="professional-after-booking-demo">
              <div className="professional-demo-label">
                <span aria-hidden="true">✨</span>
                <div>
                  <small>Menos trabalho manual</small>
                  <strong>O Agenda Fashion cuida do caminho repetitivo</strong>
                </div>
              </div>

              <div className="professional-after-booking-list">
                <div>
                  <span aria-hidden="true">1</span>
                  <p><strong>O horário fica reservado</strong><small>A disponibilidade é atualizada para evitar escolhas conflitantes.</small></p>
                </div>
                <div>
                  <span aria-hidden="true">2</span>
                  <p><strong>O agendamento entra na agenda</strong><small>Serviço, profissional, cliente, data e horário ficam reunidos.</small></p>
                </div>
                <div>
                  <span aria-hidden="true">3</span>
                  <p><strong>O WhatsApp avisa a profissional</strong><small>O aviso chega sem depender de conferir a plataforma a todo momento.</small></p>
                </div>
                <div>
                  <span aria-hidden="true">4</span>
                  <p><strong>O dashboard transforma rotina em visão</strong><small>Você acompanha agenda, faturamento previsto, clientes e serviços.</small></p>
                </div>
              </div>

              <div className="professional-after-booking-highlight">
                <span aria-hidden="true">💡</span>
                <p>
                  <strong>Você continua no controle.</strong>
                  O cliente ganha autonomia sem perder a qualidade do seu atendimento.
                </p>
              </div>
            </article>

            <article className="professional-dashboard-demo">
              <div className="professional-demo-label">
                <span aria-hidden="true">📊</span>
                <div>
                  <small>Dashboard do negócio</small>
                  <strong>Indicadores privados e protegidos</strong>
                </div>
              </div>

              <p className="professional-dashboard-intro">
                Ao entrar no painel, a profissional acompanha os números que ajudam a decidir onde melhorar e como crescer.
              </p>

              <div
                aria-label="Indicadores disponíveis no dashboard"
                className="professional-dashboard-metrics"
              >
                {DASHBOARD_CAPABILITIES.map((capability) => (
                  <div key={capability.title}>
                    <span
                      aria-hidden="true"
                      className="professional-dashboard-metric-icon"
                    >
                      {capability.emoji}
                    </span>
                    <strong>{capability.title}</strong>
                    <small>{capability.description}</small>
                  </div>
                ))}
              </div>

              <p className="professional-demo-disclaimer">
                Os dados de cada negócio são privados: somente pessoas autorizadas acessam seus indicadores.
              </p>

              <ul className="professional-dashboard-signals">
                <li>Compare os últimos 7 e 30 dias</li>
                <li>Acompanhe a agenda do período</li>
                <li>Veja o faturamento previsto</li>
                <li>Encontre os serviços mais agendados</li>
              </ul>
            </article>
          </div>

          <div className="professional-growth-cta">
            <div className="professional-growth-cta-copy">
              <strong>Comece com o essencial e acompanhe o resultado.</strong>
              <small>O plano grátis permite testar o valor do Agenda Fashion na rotina.</small>
            </div>
            <div className="professional-growth-actions">
              <Link
                className="button professional-primary-cta"
                onClick={() => trackCta("growth")}
                to={signupPath}
              >
                Testar grátis no meu negócio
              </Link>
            </div>
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
