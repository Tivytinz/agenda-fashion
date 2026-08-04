export function BrandProgressMark({
  current = 1,
  total = 4,
  complete = false,
  className = ""
}) {
  const safeTotal = Math.max(Number(total) || 1, 1);
  const progress = complete
    ? 1
    : Math.min(Math.max(Number(current) || 0, 0), safeTotal) / safeTotal;
  const coloredPieces = Math.ceil(progress * 6);
  const pieceClass = (index) => (
    index < coloredPieces ? "brand-progress-piece active" : "brand-progress-piece"
  );

  return (
    <svg
      aria-label={complete
        ? "Símbolo do Agenda Fashion completo"
        : `Progresso do agendamento: etapa ${current} de ${safeTotal}`}
      className={`brand-progress-mark ${className}`.trim()}
      role="img"
      viewBox="0 0 72 72"
    >
      <title>Agenda Fashion</title>
      <path className={pieceClass(0)} d="M24 25v-9a5 5 0 0 1 10 0v9Z" />
      <path className={pieceClass(1)} d="M34 23V11a5 5 0 0 1 10 0v12Z" />
      <path className={pieceClass(2)} d="M44 25V14a5 5 0 0 1 10 0v14Z" />
      <path className={pieceClass(3)} d="M54 31V21a5 5 0 0 1 10 0v19Z" />
      <path className={pieceClass(4)} d="M24 32 15 25a6 6 0 0 0-8 9l17 17Z" />
      <path
        className={pieceClass(5)}
        d="M24 23h40v20c0 14-9 23-22 23-11 0-18-5-22-14l-5-12 9-8Z"
      />
      <path className="brand-progress-nail" d="M27 16h4v7h-4zM37 11h4v10h-4zM47 14h4v9h-4zM57 21h4v8h-4z" />
    </svg>
  );
}
