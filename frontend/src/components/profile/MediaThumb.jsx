import { useRetryingMedia } from "../../hooks/useRetryingMedia";

export function MediaThumb({
  src,
  alt,
  className = "",
  emoji = "💅",
  loading = "lazy",
  fetchPriority = "auto"
}) {
  const {
    handleError,
    hasImage,
    imageUrl
  } = useRetryingMedia(src, { width: 320 });

  return (
    <span className={`af-media-thumb ${className}`.trim()}>
      {hasImage ? (
        <img
          src={imageUrl}
          alt={alt}
          decoding="async"
          fetchPriority={fetchPriority}
          loading={loading}
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
