import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { formatCep } from "../../utils/format";

// O endereço mantém sua própria geração sem assumir o lock de gravação do perfil.
export function useBusinessAddress({ create, usuarioId, form, setForm, setSavedForm, loading }) {
  const [cepLookup, setCepLookup] = useState({ status: "idle", message: "" });
  const cepRequestRef = useRef(0);
  const addressEditsRef = useRef({ endereco: 0, bairro: 0, cidade: 0, estado: 0 });

  function resetCepLookup() {
    cepRequestRef.current += 1;
    setCepLookup({ status: "idle", message: "" });
  }

  useEffect(() => {
    setCepLookup({ status: "idle", message: "" });
    return () => { cepRequestRef.current += 1; };
  }, [create, usuarioId]);

  useEffect(() => {
    if (create || loading) return;

    const cepDigits = String(form.cep || "").replace(/\D/g, "");
    if (cepDigits.length === 8 && !String(form.endereco || "").trim()) {
      lookupCep(cepDigits, { syncBaseline: true });
    }
  }, [create, loading]);

  function update(field, value) {
    if (Object.hasOwn(addressEditsRef.current, field)) addressEditsRef.current[field] += 1;
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function lookupCep(value, { syncBaseline = false } = {}) {
    const cepDigits = String(value || "").replace(/\D/g, "");
    if (cepDigits.length !== 8) return;

    const requestId = cepRequestRef.current + 1;
    cepRequestRef.current = requestId;
    const addressEditsAtRequest = { ...addressEditsRef.current };
    setCepLookup({ status: "loading", message: "Buscando endereço..." });

    try {
      const result = await apiRequest(`/cep/${cepDigits}`, {
        timeoutMs: 6000
      });
      if (requestId !== cepRequestRef.current) return;

      const addressPatch = Object.fromEntries(Object.entries({
        endereco: result.endereco || "",
        bairro: result.bairro || "",
        cidade: result.cidade || "",
        estado: result.estado || ""
      }).filter(([field]) => addressEditsRef.current[field] === addressEditsAtRequest[field]));

      setForm((current) => {
        const currentCep = String(current.cep || "").replace(/\D/g, "");
        if (currentCep !== cepDigits) return current;

        return {
          ...current,
          ...addressPatch
        };
      });

      if (syncBaseline) {
        setSavedForm((current) => {
          const currentCep = String(current.cep || "").replace(/\D/g, "");
          if (currentCep !== cepDigits) return current;

          return {
            ...current,
            ...addressPatch
          };
        });
      }

      setCepLookup({
        status: "success",
        message: result.endereco
          ? "Endereço encontrado. Complete o número. O complemento é opcional."
          : "CEP encontrado. Complete o endereço e o número. O complemento é opcional."
      });
    } catch (requestError) {
      if (requestId !== cepRequestRef.current) return;

      const notFound = /CEP não encontrado/i.test(requestError?.message || "");
      setCepLookup({
        status: "error",
        message: notFound
          ? "CEP não encontrado. Confira os números ou preencha o endereço manualmente."
          : "Não foi possível consultar o CEP agora. Preencha o endereço manualmente."
      });
    }
  }

  function handleCepChange(event) {
    const formattedCep = formatCep(event.target.value);
    const cepDigits = String(formattedCep || "").replace(/\D/g, "");
    update("cep", formattedCep);

    if (cepDigits.length !== 8) {
      cepRequestRef.current += 1;
      setCepLookup({ status: "idle", message: "" });
      return;
    }

    lookupCep(cepDigits);
  }

  function handleCepBlur() {
    const cepDigits = String(form.cep || "").replace(/\D/g, "");
    if (
      cepDigits.length === 8
      && cepLookup.status !== "loading"
      && cepLookup.status !== "success"
    ) {
      lookupCep(cepDigits);
    }
  }

  return { cepLookup, update, handleCepChange, handleCepBlur, resetCepLookup };
}
