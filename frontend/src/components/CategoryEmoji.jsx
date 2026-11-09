import ciliosEmoji from "../assets/icons/cilios-emoji.png";
import sobrancelhasEmoji from "../assets/icons/sobrancelhas-emoji.png";

const CUSTOM_CATEGORY_IMAGES = {
  "👁️": ciliosEmoji,
  "〰️": sobrancelhasEmoji
};

// The category helper keeps its text contract; only the visual rendering has exceptions.
export function CategoryEmoji({ emoji, className = "" }) {
  const image = CUSTOM_CATEGORY_IMAGES[emoji];
  return (
    <span
      aria-hidden="true"
      className={["category-emoji", image ? "is-custom-beauty" : "native-emoji", className].filter(Boolean).join(" ")}
      style={image ? { "--beauty-emoji-url": `url(${image})` } : undefined}
    >
      {image ? "" : emoji}
    </span>
  );
}
