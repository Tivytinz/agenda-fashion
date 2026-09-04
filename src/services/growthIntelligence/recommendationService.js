function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 1);
}

function scoreOpportunity(opportunity) {
  return Number((
    clamp01(opportunity?.impacto) *
    clamp01(opportunity?.confianca) *
    clamp01(opportunity?.urgencia)
  ).toFixed(3));
}

function rankGrowthOpportunities(opportunities = []) {
  return opportunities
    .map((opportunity) => ({
      ...opportunity,
      score: scoreOpportunity(opportunity),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return String(left.codigo).localeCompare(String(right.codigo));
    });
}

module.exports = {
  scoreOpportunity,
  rankGrowthOpportunities,
};
