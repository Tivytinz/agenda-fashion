import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState
} from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
  Link
} from "react-router-dom";
import { DiscoveryBoundary } from "../components/DiscoveryBoundary";
import { LoadingState } from "../components/ScreenState";
import { HomeHero } from "../components/HomeHero";
import { usePageMetadata } from "../hooks/usePageMetadata";

const ExplorePage = lazy(() =>
  import("./ExplorePage").then((module) => ({
    default: module.ExplorePage
  }))
);

export function HomePage() {
  usePageMetadata(
    "Agenda Fashion | Agendamento de beleza online",
    "Encontre profissionais e negócios de beleza, compare serviços e agende seu horário online pelo Agenda Fashion."
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const discoveryRef = useRef(null);
  const [filterTarget, setFilterTarget] = useState(null);
  const [discoveryMounted, setDiscoveryMounted] = useState(false);
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(
    () => ["#buscar-servicos", "#como-funciona"].includes(location.hash)
  );

  useEffect(() => {
    if (showDiscovery) return undefined;

    const timeout = window.setTimeout(() => {
      setShowDiscovery(true);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [showDiscovery]);

  useEffect(() => {
    if (!["#buscar-servicos", "#como-funciona"].includes(location.hash)) return;

    setShowDiscovery(true);
    if (!discoveryMounted) return;
    const frame = window.requestAnimationFrame(() => {
      const target = location.hash === "#como-funciona"
        ? document.getElementById("como-funciona")
        : discoveryRef.current;
      target?.scrollIntoView?.({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.search, location.key, discoveryMounted]);

  function exploreCategory(category) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("categoria", category);
    navigate({ pathname: location.pathname, search: `?${nextParams}`, hash: "#buscar-servicos" }, { replace: true });
    setShowDiscovery(true);
  }

  function showHowItWorks() {
    setShowDiscovery(true);
    navigate({ pathname: location.pathname, search: location.search, hash: "#como-funciona" });
  }

  return (
    <main className="home-page">
      <div className="home-filter-slot" ref={setFilterTarget}>
        {!discoveryMounted && !discoveryFailed && <section className="container home-discovery-filters home-filter-loading" aria-label="Carregando filtro de cidade" aria-busy="true">
          <div className="home-location-pill"><span>Cidade</span><span>Carregando cidades…</span></div>
        </section>}
      </div>
      <HomeHero onExploreCategory={exploreCategory} onShowHowItWorks={showHowItWorks} />
      <div id="buscar-servicos" ref={discoveryRef}>
        {showDiscovery && (
          <DiscoveryBoundary onError={() => setDiscoveryFailed(true)}>
            <Suspense fallback={<LoadingState>Carregando catálogo…</LoadingState>}>
              <ExplorePage renderHero={false} filterTarget={filterTarget} onMounted={setDiscoveryMounted} />
            </Suspense>
          </DiscoveryBoundary>
        )}
      </div>
      <section
        aria-labelledby="home-professionals-heading"
        className="container home-professionals-entry"
      >
        <div className="home-professionals-copy">
          <p className="eyebrow">Para quem trabalha com beleza</p>
          <h2 id="home-professionals-heading">Sua cliente agenda. Você atende.</h2>
          <p>Conheça a agenda online para organizar serviços, horários e agendamentos do seu negócio.</p>
        </div>
        <nav
          aria-label="Conheça o Agenda Fashion para profissionais"
          className="home-professionals-links"
        >
          <Link className="button home-professionals-primary" to="/para-profissionais">
            Agenda online para profissionais
          </Link>
          <Link className="home-professionals-secondary" to="/planos">
            Conhecer os planos
          </Link>
        </nav>
      </section>
    </main>
  );
}
