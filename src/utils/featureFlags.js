function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    String(valor || "").trim().toLowerCase()
  );
}

module.exports = {
  flagAtiva,
};
