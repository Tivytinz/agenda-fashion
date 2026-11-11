import { ApiError } from "./errors";

export const DEFAULT_TIMEOUT_MS = 20000;

// O prazo abrange a operação inteira, inclusive corpo e consultas encadeadas.
export async function withRequestLifecycle(operation, { signal: externalSignal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });

  const timeoutId = Number(timeoutMs) > 0 ? window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Number(timeoutMs)) : null;
  const abortReason = () => controller.signal.reason || new DOMException("Solicitação cancelada.", "AbortError");
  const throwIfAborted = () => { if (controller.signal.aborted) throw abortReason(); };
  let rejectOnAbort;
  const aborted = new Promise((_, reject) => {
    rejectOnAbort = () => reject(abortReason());
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
    if (controller.signal.aborted) rejectOnAbort();
  });
  async function execute() {
    throwIfAborted();
    const result = await operation({ signal: controller.signal, throwIfAborted });
    throwIfAborted();
    return result;
  }
  try {
    return await Promise.race([execute(), aborted]);
  } catch (error) {
    if (timedOut) {
      throw new ApiError("A solicitação demorou demais. Verifique sua conexão e tente novamente.", 408, { codigo: "REQUEST_TIMEOUT" });
    }
    throw error;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
}
