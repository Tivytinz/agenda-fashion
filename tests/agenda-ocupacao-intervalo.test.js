jest.mock("../src/db/db", () => ({}));
const { materializarAgendaProfissional, materializarAgendaGeral } = require("../src/services/agendaOperacionalService");

function materializar(tipo, reservas, { data = "2026-10-22", ativo = true, horas = ["09:00", "10:00", "11:00", "12:00"] } = {}) {
  const horarios = horas.map((hora) => ({ hora, status: "livre" }));
  if (tipo === "profissional") return materializarAgendaProfissional([{ data, horarios }], reservas)[0].horarios;
  return materializarAgendaGeral([{ data, profissionais: [{ id: 7, ativo, horarios }] }], reservas, [])[0].profissionais[0].horarios;
}
const reserva = {
  agendamento_id: 42, profissional_id: 7, data: "2026-10-22", hora: "09:30",
  status: "confirmado", duracao_minutos: 90, cliente: "Ana", pode_reagendar: true,
};

describe.each(["dona", "profissional"])("ocupação por intervalo na agenda %s", (tipo) => {
  test("ocupa o ponto intermediário e libera exatamente o fim, sem duplicar ações", () => {
    const slots = materializar(tipo, [reserva]);
    expect(slots.find((s) => s.hora === "09:30")).toMatchObject({ agendamento_id: 42, pode_reagendar: true });
    expect(slots.find((s) => s.hora === "10:00")).toEqual({ hora: "10:00", status: "ocupado" });
    expect(slots.find((s) => s.hora === "11:00").status).toBe("livre");
    expect(slots.filter((s) => s.agendamento_id)).toHaveLength(1);
  });

  test.each(["realizado", "falta", "cancelado"])("%s não ocupa os pontos intermediários", (status) => {
    expect(materializar(tipo, [{ ...reserva, status }]).find((s) => s.hora === "10:00").status).toBe("livre");
  });

  test("ocupa o dia seguinte mesmo quando o início ficou fora da janela", () => {
    const slots = materializar(tipo, [{ ...reserva, data: "2026-10-21", hora: "23:30",
      ocupacao_fim_local: "2026-10-22T01:00:00" }], { horas: ["00:00", "00:30", "01:00"] });
    expect(slots).toEqual([
      expect.objectContaining({ hora: "00:00", status: "confirmado", agendamento_id: 42,
        continuacao: true, data_agendamento: "2026-10-21", hora_agendamento: "23:30" }),
      { hora: "00:30", status: "ocupado" },
      { hora: "01:00", status: "livre" },
    ]);
  });

  test("ocupa intervalo externo redigido sem anexar metadados da reserva", () => {
    const slots = materializar(tipo, [{ ...reserva, agendamento_id: null, cliente: null,
      servico: null, duracao_minutos: null, ocupacao_fim_local: "2026-10-22T11:00:00",
      pode_reagendar: false }]);
    expect(slots.find((s) => s.hora === "10:00")).toEqual({ hora: "10:00", status: "ocupado" });
    expect(slots.some((s) => s.cliente || s.agendamento_id || s.pode_reagendar)).toBe(false);
  });
});

test("inativa mantém somente os cartões de suas reservas, sem criar grade ocupada", () => {
  expect(materializar("dona", [reserva], { ativo: false })).toEqual([
    expect.objectContaining({ hora: "09:30", agendamento_id: 42 }),
  ]);
});

test("inativa mostra a continuação própria com ações e sem grade livre nem compromissos externos", () => {
  const own = { ...reserva, data: "2026-10-21", hora: "23:30", ocupacao_fim_local: "2026-10-22T01:00:00" };
  const external = { ...own, agendamento_id: null, cliente: null, servico: null };
  expect(materializar("dona", [own, external], { ativo: false })).toEqual([
    expect.objectContaining({ hora: "00:00", continuacao: true, agendamento_id: 42,
      data_agendamento: "2026-10-21", hora_agendamento: "23:30", pode_reagendar: true }),
  ]);
});

test("o fim exclusivo e os resultados terminais não criam cartão de continuação", () => {
  const previous = { ...reserva, data: "2026-10-21", hora: "23:00" };
  for (const record of [
    { ...previous, ocupacao_fim_local: "2026-10-22T00:00:00" },
    ...["cancelado", "realizado", "falta"].map((status) => ({ ...previous, status, ocupacao_fim_local: "2026-10-22T02:00:00" })),
  ]) expect(materializar("dona", [record], { ativo: false })).toEqual([]);
});
