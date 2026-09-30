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
import { HomeHero } from "../components/HomeHero";
import { usePageMetadata } from "../hooks/usePageMetadata";

const ExplorePage = lazy(() =>
  import("./ExplorePage").then((module) => ({
    default: module.ExplorePage
  }))
);

export function HomePage() {
  usePageMetadata(
    "Agenda Fashion",
    "Encontre serviços de beleza, escolha um horário e agende pelo Agenda Fashion."
  );
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
