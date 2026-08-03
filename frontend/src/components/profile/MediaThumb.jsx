import { useState } from "react";
import { resolveMediaUrl } from "../../utils/media";

export function MediaThumb({
  src,
  alt,
  className = "",
  emoji = "💅"
}) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src) && !failed;
  const imageUrl = resolveMediaUrl(src);

  return (
    <span className={`af-media-thumb ${className}`.trim()}>
      {hasImage ? (
        <img
          src={imageUrl}
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
