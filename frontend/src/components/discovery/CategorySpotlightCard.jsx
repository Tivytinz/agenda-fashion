import { CategoryEmoji } from "../CategoryEmoji";
import { serviceCategoryEmoji } from "../../utils/specialties";

export function CategorySpotlightCard({
  active,
  category,
  label,
  onSelect,
  subtitle
}) {

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
        <CategoryEmoji className="home-category-emoji" emoji={serviceCategoryEmoji(category, label)} />

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

