import { apiRequest } from "../../api/client";
import { extractServices } from "../../utils/serviceCatalog";

// Reconciliação somente por GET; tentativas ausentes conservam a mesma chave.
export async function reconcileGalleryUploads({ attempts, signal, isCurrent, confirmPhoto, resolveFile }) {
  let removed = false;
  for (const [file, attempt] of attempts) {
    if (!attempt.uncertain) continue;
    try {
      const result = await apiRequest(`/servicos/${attempt.servicoId}/fotos/tentativa`, {
        headers: { "Idempotency-Key": attempt.key }, signal,
      });
      if (!isCurrent()) return null;
      if (result.estado === "nao_encontrada") {
        attempt.uncertain = false;
        continue;
      }
      if (!result.foto?.id) throw new Error("Não foi possível identificar a foto salva.");
      confirmPhoto(result.foto);
    } catch (failure) {
      if (!isCurrent()) return null;
      if (Number(failure.status) !== 410) throw failure;
      removed = true;
    }
    attempts.delete(file);
    resolveFile(file);
  }
  return isCurrent() ? { removed } : null;
}

export async function readServiceMedia({ id, signal, isCurrent }) {
  const [servicesResult, photosResult] = await Promise.all([
    apiRequest("/servicos", { signal }),
    apiRequest(`/servicos/${id}/fotos`, { signal }),
  ]);
  if (!isCurrent()) return null;
  const confirmed = extractServices(servicesResult).find(item => Number(item.id) === Number(id));
  if (!confirmed) throw new Error("Serviço não encontrado. Volte aos serviços para continuar.");
  const photos = Array.isArray(photosResult) ? photosResult : photosResult?.fotos;
  if (!Array.isArray(photos)) throw new Error("Não foi possível confirmar as fotos atuais. Verifique novamente.");
  return { photos, patch: { foto_url: confirmed.foto_url || "", foto_public_id: confirmed.foto_public_id || "" } };
}
