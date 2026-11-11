import { useEffect, useState } from "react";

// A prévia recebe o arquivo, nunca uma URL derivada de campos do formulário.
export function FileImagePreview({ file, alt }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!(file instanceof Blob)) return undefined;
    const url = URL.createObjectURL(file);
    if (!url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
      return undefined;
    }
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = preview?.file === file ? preview?.url || "" : "";
  if (!src.startsWith("blob:")) return null;
  return <img alt={alt} src={src} />;
}
