import { Children, useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "../AppIcon";

export function HorizontalRail({
  ariaLabel,
  children,
  className
}) {
  const trackRef = useRef(null);
  const itemCount = Children.count(children);
  const [scrollState, setScrollState] = useState({
    previous: false,
    next: false
  });

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;

    if (!track) return;

    const maximum = Math.max(track.scrollWidth - track.clientWidth, 0);

    setScrollState({
      previous: track.scrollLeft > 4,
      next: maximum > 4 && track.scrollLeft < maximum - 4
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateScrollState)
      : null;

    if (observer && trackRef.current) {
      observer.observe(trackRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateScrollState);
      observer?.disconnect();
    };
  }, [itemCount, updateScrollState]);

  function move(direction) {
    const track = trackRef.current;

    if (!track) return;

    const distance = Math.max(track.clientWidth * 0.82, 280) * direction;

    if (typeof track.scrollBy === "function") {
      track.scrollBy({ left: distance, behavior: "smooth" });
    } else {
      track.scrollLeft += distance;
    }

    window.requestAnimationFrame(updateScrollState);
  }

  return (
    <div className="home-rail-shell">
      {(scrollState.previous || scrollState.next) && (
        <button
          aria-label={`Voltar em ${ariaLabel.toLocaleLowerCase("pt-BR")}`}
          className="home-rail-control previous"
          aria-disabled={!scrollState.previous}
          onClick={() => scrollState.previous && move(-1)}
          type="button"
        >
          <AppIcon className="home-arrow-icon" name="chevron" />
        </button>
      )}

      <div
        aria-label={ariaLabel}
        className={className}
        onScroll={updateScrollState}
        ref={trackRef}
        tabIndex={scrollState.previous || scrollState.next ? 0 : undefined}
      >
        {children}
      </div>

      {(scrollState.previous || scrollState.next) && (
        <button
          aria-label={`Avançar em ${ariaLabel.toLocaleLowerCase("pt-BR")}`}
          className="home-rail-control next"
          aria-disabled={!scrollState.next}
          onClick={() => scrollState.next && move(1)}
          type="button"
        >
          <AppIcon className="home-arrow-icon" name="chevron" />
        </button>
      )}
    </div>
  );
}

