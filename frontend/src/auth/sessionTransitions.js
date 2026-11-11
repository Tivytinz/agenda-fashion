// Escritas de cookie precisam terminar na ordem em que foram solicitadas.
// Cancelar só o estado React não desfaz um Set-Cookie recebido do servidor.
export function createSessionTransitions() {
  let currentIntent = 0;
  let tail = Promise.resolve();
  return {
    begin() { return ++currentIntent; },
    isCurrent(intent) { return intent === currentIntent; },
    enqueue(operation) {
      const result = tail.then(operation);
      tail = result.catch(() => {});
      return result;
    }
  };
}

export function supersededSessionTransition() {
  return new DOMException("Esta autenticação foi substituída por outra ação de conta.", "AbortError");
}
