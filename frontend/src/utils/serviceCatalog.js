export const SERVICE_CATEGORIES = [
  ["unha", "Unhas"],
  ["cabelo", "Cabelos"],
  ["cilio", "Cílios"],
  ["sobrancelha", "Sobrancelhas"],
  ["maquiagem", "Maquiagem"],
  ["estetica", "Estética"],
  ["bronzeamento", "Bronzeamento"],
  ["outro", "Outro"]
];
export const categoryLabel = (value) => SERVICE_CATEGORIES.find(([key]) => key === value)?.[1] || "Sem categoria";
export function extractServices(result) {
  return Array.isArray(result) ? result : result?.servicos || [];
}

export function uncertainWrite(error) {
  const status = Number(error.status || error.statusCode);
  return !status || status >= 500 || status === 408;
}
