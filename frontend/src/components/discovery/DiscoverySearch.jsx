import { DiscoveryLocationFilter } from "../DiscoveryLocationFilter";
import { serviceCategoryLabel } from "../../utils/specialties";

export function DiscoverySearch({ controller, id }) {
  const { selectedLocationKey, locationOptions, query, searchCatalog, status,
    locationsReady, draftResetKey, category, chooseCategory, loadBusinesses } = controller;
  return <DiscoveryLocationFilter id={id} value={selectedLocationKey} options={locationOptions}
    query={query} onSearch={searchCatalog} status={status} locationsReady={locationsReady}
    resetKey={draftResetKey} categoryLabel={category ? serviceCategoryLabel(category) : ""}
    onClearCategory={() => chooseCategory("")} onRetry={loadBusinesses} />;
}
