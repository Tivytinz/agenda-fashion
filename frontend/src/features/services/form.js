export const EMPTY_FORM = {
  nome: "",
  descricao: "",
  categoria: "",
  valor: "",
  duracao_minutos: "60",
  ativo: true,
  foto_url: "",
  foto_public_id: ""
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function serviceForm(service, fallback = EMPTY_FORM) {
  return {
    nome: service.nome ?? fallback.nome,
    descricao: service.descricao === undefined ? fallback.descricao : service.descricao || "",
    categoria: service.categoria ?? fallback.categoria,
    valor: String(service.valor ?? fallback.valor),
    duracao_minutos: String(service.duracao_minutos ?? fallback.duracao_minutos),
    ativo: service.ativo === undefined ? fallback.ativo : service.ativo !== false,
    foto_url: service.foto_url === undefined ? fallback.foto_url : service.foto_url || "",
    foto_public_id: service.foto_public_id === undefined ? fallback.foto_public_id : service.foto_public_id || "",
  };
}

export function serviceBody(form) {
  return {
    nome: form.nome.trim(), descricao: form.descricao.trim(), categoria: form.categoria,
    valor: Number(form.valor), duracao_minutos: Number(form.duracao_minutos), ativo: form.ativo,
  };
}

export function validateImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Cada imagem pode ter no máximo 5 MB.";
  }
  return "";
}

export function samePhoto(photo, fotoUrl, fotoPublicId) {
  if (fotoPublicId && photo?.foto_public_id) {
    return fotoPublicId === photo.foto_public_id;
  }
  return Boolean(fotoUrl && photo?.foto_url && fotoUrl === photo.foto_url);
}
