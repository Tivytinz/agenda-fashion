import { useState } from "react";

export function MediaThumb({
  src,
  alt,
  className = "",
  emoji = "💅"
}) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src) && !failed;

  return (
    <span className={`af-media-thumb ${className}`.trim()}>
      {hasImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="af-media-fallback" aria-hidden="true">
          {emoji}
        </span>
      )}
    </span>
  );
}
