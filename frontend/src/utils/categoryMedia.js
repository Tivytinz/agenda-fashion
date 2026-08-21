import bronzeamentoCard from "../assets/home/bronzeamento-card.webp";
import cabelosCard from "../assets/home/cabelos-card.webp";
import ciliosCard from "../assets/home/cilios-card.webp";
import esteticaCard from "../assets/home/estetica-card.webp";
import maquiagemCard from "../assets/home/maquiagem-card.webp";
import sobrancelhasCard from "../assets/home/sobrancelhas-card.webp";
import unhasCard from "../assets/home/unhas-card.webp";
import { normalizeText } from "./format";

export const CATEGORY_CARD_IMAGES = Object.freeze({
  unha: unhasCard,
  cabelo: cabelosCard,
  estetica: esteticaCard,
  bronzeamento: bronzeamentoCard,
  cilio: ciliosCard,
  sobrancelha: sobrancelhasCard,
  maquiagem: maquiagemCard
});

export function categoryMediaKey(value, fallbackValue = "") {
  const candidates = [value, fallbackValue]
    .map(normalizeText)
    .filter(Boolean);

  for (const candidate of candidates) {
    if (/unha|manicure|pedicure|nail|esmalta/.test(candidate)) return "unha";
    if (/cabelo|cabeleir|corte|escova|penteado|barba/.test(candidate)) return "cabelo";
    if (/cilio|lash/.test(candidate)) return "cilio";
    if (/sobrancelha|brow|henna|micropigmenta/.test(candidate)) return "sobrancelha";
    if (/maquiagem|makeup|make up/.test(candidate)) return "maquiagem";
    if (/bronzeamento|bronze artificial|bronze natural|marquinha|spray tan/.test(candidate)) {
      return "bronzeamento";
    }
    if (/estetica|pele|depil|massagem|drenagem|facial|corporal/.test(candidate)) {
      return "estetica";
    }
  }

  return "";
}

export function categoryCardImage(value, fallbackValue = "") {
  return CATEGORY_CARD_IMAGES[categoryMediaKey(value, fallbackValue)] || "";
}
