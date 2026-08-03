import { useEffect, useState } from "react";
import { resolveMediaUrl, withMediaRetry } from "../../utils/media";

export function MediaThumb({
  src,
  alt,
  className = "",
  emoji = "💅"
}) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const hasImage = Boolean(src) && !failed;
  const imageUrl = withMediaRetry(resolveMediaUrl(src, { width: 320 }), retry);

  useEffect(() => {
    setFailed(false);
    setRetry(0);
  }, [src]);

  function handleError() {
    if (retry < 1) {
      setRetry(1);
      return;
    }
    setFailed(true);
  }

  return (
    <span className={`af-media-thumb ${className}`.trim()}>
      {hasImage ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          onError={handleError}
        />
      ) : (
        <span className="af-media-fallback" aria-hidden="true">
          {emoji}
        </span>
      )}
    </span>
  );
}
