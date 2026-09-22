import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState
} from "react";
import {
  useLocation,
  useSearchParams
} from "react-router-dom";
import bronzeamentoHero from "../assets/home/bronzeamento-hero.webp";
import ciliosHero from "../assets/home/cilios-hero.webp";
import manicureHero from "../assets/home/manicure-hero.webp";
import maquiagemHero from "../assets/home/maquiagem-hero.webp";
import skincareHero from "../assets/home/skincare-hero.webp";
import sobrancelhasHero from "../assets/home/sobrancelhas-hero.webp";

const ExplorePage = lazy(() =>
  import("./ExplorePage").then((module) => ({
    default: module.ExplorePage
  }))
);

const HERO_SLIDES = [
  {
    image: "/assets/home/salon-hero-wide.webp",
    mobileImage: "/assets/home/salon-hero-mobile.webp",
    title: "Beleza para você",
    subtitle: "Cabelos do seu jeito",
    description: "Encontre cortes, tratamentos e profissionais para cuidar dos seus cabelos.",
    category: "cabelo"
  },
  {
    image: manicureHero,
    title: "Unhas do seu jeito",
    subtitle: "Cuidado em cada detalhe",
    description: "Encontre manicures, veja opções e escolha o melhor horário para você.",
    category: "unha"
  },
  {
    image: skincareHero,
    title: "Seu momento de cuidado",
    subtitle: "Estética com praticidade",
    description: "Conheça tratamentos, profissionais e horários disponíveis no Agenda Fashion.",
    category: "estetica"
  },
  {
    image: bronzeamentoHero,
    title: "Seu brilho em destaque",
    subtitle: "Bronzeamento com praticidade",
    description: "Compare opções de bronzeamento e escolha o cuidado ideal para você.",
    category: "bronzeamento"
  },
  {
    image: ciliosHero,
    title: "Um olhar que encanta",
    subtitle: "Cílios feitos para você",
    description: "Encontre especialistas em cílios e agende seu próximo atendimento.",
    category: "cilio"
  },
  {
    image: sobrancelhasHero,
    title: "Expressão em cada detalhe",
    subtitle: "Sobrancelhas que valorizam você",
    description: "Descubra profissionais de design e encontre o melhor horário para você.",
    category: "sobrancelha"
  },
  {
    image: maquiagemHero,
    title: "Pronta para seu momento",
    subtitle: "Maquiagem para toda ocasião",
    description: "Escolha sua produção, compare profissionais e agende em poucos passos.",
    category: "maquiagem"
  }
];

function HomeHero({ onExploreCategory }) {
  const [activeHero, setActiveHero] = useState(0);
  const [heroRotationPaused, setHeroRotationPaused] = useState(() =>
    Boolean(window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches)
  );
  const heroTouchStart = useRef(null);

  useEffect(() => {
    if (heroRotationPaused) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveHero((current) =>
        (current + 1) % HERO_SLIDES.length);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [heroRotationPaused]);

  function showHero(index) {
    setHeroRotationPaused(true);
    setActiveHero(
      (index + HERO_SLIDES.length) % HERO_SLIDES.length
    );
  }

  function handleHeroTouchStart(event) {
    heroTouchStart.current =
      event.touches[0]?.clientX ?? null;
  }

  function handleHeroTouchEnd(event) {
    const start = heroTouchStart.current;
    const end = event.changedTouches[0]?.clientX;
    heroTouchStart.current = null;

    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      Math.abs(start - end) < 45
    ) {
      return;
    }

    showHero(activeHero + (start > end ? 1 : -1));
  }

  return (
    <section
      aria-label="Destaques do Agenda Fashion"
      aria-roledescription="carrossel"
      className="home-hero"
      onTouchEnd={handleHeroTouchEnd}
      onTouchStart={handleHeroTouchStart}
    >
      <div className="container home-hero-frame">
        <div
          className="home-hero-track"
          style={{
            transform: `translateX(-${activeHero * 100}%)`
          }}
        >
          {HERO_SLIDES.map((slide, index) => (
            <article
              aria-hidden={activeHero !== index}
              aria-label={`${index + 1} de ${HERO_SLIDES.length}`}
              className="home-hero-slide"
              key={slide.title}
            >
              <picture>
                {slide.mobileImage && (
                  <source
                    media="(max-width: 767px)"
                    srcSet={slide.mobileImage}
                  />
                )}
                <img
                  alt=""
                  className="home-hero-image"
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "low"}
                  loading={index === 0 ? "eager" : "lazy"}
                  src={slide.image}
                />
              </picture>

              <div className="home-hero-overlay" />

              <div className="home-hero-content">
                <h1>{slide.title}</h1>
                <p className="home-hero-subtitle">{slide.subtitle}</p>
                <p className="home-hero-description">{slide.description}</p>

                <div className="home-hero-actions">
                  <button
                    className="button home-hero-primary"
                    onClick={() => onExploreCategory(slide.category)}
                    tabIndex={activeHero === index ? 0 : -1}
                    type="button"
                  >
                    Explorar serviços
                    <span aria-hidden="true">→</span>
                  </button>

                  <a
                    className="button home-hero-secondary"
                    href="#como-funciona"
                    tabIndex={activeHero === index ? 0 : -1}
                  >
                    Como funciona
                    <span aria-hidden="true" className="home-hero-play">▷</span>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <button
          aria-label="Destaque anterior"
          className="home-hero-arrow previous"
          onClick={() => showHero(activeHero - 1)}
          type="button"
        >
          ‹
        </button>

        <button
          aria-label="Próximo destaque"
          className="home-hero-arrow next"
          onClick={() => showHero(activeHero + 1)}
          type="button"
        >
          ›
        </button>

        <div aria-label="Escolher destaque" className="home-hero-dots">
          {HERO_SLIDES.map((slide, index) => (
            <button
              aria-label={`Mostrar destaque ${index + 1}: ${slide.title}`}
              aria-pressed={activeHero === index}
              key={slide.title}
              onClick={() => showHero(index)}
              type="button"
            />
          ))}
        </div>

        <button
          aria-label={heroRotationPaused
            ? "Retomar rotação automática dos destaques"
            : "Pausar rotação automática dos destaques"}
          aria-pressed={heroRotationPaused}
          className="home-hero-rotation-toggle"
          onClick={() =>
            setHeroRotationPaused((current) => !current)}
          type="button"
        >
          <span aria-hidden="true">
            {heroRotationPaused ? "▶" : "⏸"}
          </span>
        </button>
      </div>
    </section>
  );
}

export function HomePage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const discoveryRef = useRef(null);
  const [showDiscovery, setShowDiscovery] = useState(
    () => location.hash === "#buscar-servicos"
  );

  useEffect(() => {
    if (showDiscovery) return undefined;

    const timeout = window.setTimeout(() => {
      setShowDiscovery(true);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [showDiscovery]);

  useEffect(() => {
    if (location.hash !== "#buscar-servicos") return;

    setShowDiscovery(true);
    window.requestAnimationFrame(() => {
      discoveryRef.current?.scrollIntoView?.({ block: "start" });
    });
  }, [location.hash]);

  function exploreCategory(category) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("categoria", category);
    setSearchParams(nextParams, { replace: true });
    setShowDiscovery(true);

    window.requestAnimationFrame(() => {
      discoveryRef.current?.scrollIntoView?.({ block: "start" });
    });
  }

  return (
    <main className="home-page">
      <HomeHero onExploreCategory={exploreCategory} />
      <div id="buscar-servicos" ref={discoveryRef}>
        {showDiscovery && (
          <Suspense fallback={null}>
            <ExplorePage renderHero={false} />
          </Suspense>
        )}
      </div>
    </main>
  );
}
