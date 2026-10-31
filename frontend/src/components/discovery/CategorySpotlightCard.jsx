import sobrancelhasEmoji from "../../assets/icons/sobrancelhas-emoji.png";
import { serviceCategoryEmoji } from "../../utils/specialties";

export function CategorySpotlightCard({
  active,
  category,
  label,
  onSelect,
  subtitle
}) {
  const customEyebrowEmoji = category === "sobrancelha";

  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={active
        ? "home-category-card active"
        : "home-category-card"}
      onClick={() => onSelect(active ? "" : category)}
      type="button"
    >
      <span className="home-category-visual">
        <span
          aria-hidden="true"
          className={customEyebrowEmoji
            ? "home-category-emoji is-custom-eyebrow"
            : "home-category-emoji"}
          style={customEyebrowEmoji
            ? { "--eyebrow-emoji-url": `url(${sobrancelhasEmoji})` }
            : undefined}
        >
          {customEyebrowEmoji
            ? ""
            : serviceCategoryEmoji(category, label)}
        </span>

        <span className="home-category-shade" />
      </span>

      <span className="home-category-copy">
        <span>
          <strong>{label}</strong>
          <small>{subtitle}</small>
        </span>

      </span>
    </button>
  );
}

