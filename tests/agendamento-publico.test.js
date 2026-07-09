const request = require("supertest");
const app = require("../src/server");

describe("Fluxo de agendamento público", () => {
  test("visitante consegue abrir perfil, escolher serviço, profissional, horário e agendar", async () => {
    const slug = "teste-1";

    const perfil = await request(app)
      .get(`/perfil-negocio/${slug}`);

    expect(perfil.statusCode).toBe(200);
    expect(perfil.body.servicos.length).toBeGreaterThan(0);
    expect(perfil.body.profissionais.length).toBeGreaterThan(0);

    const servico = perfil.body.servicos[0];
    const profissional = perfil.body.profissionais[0];

    const agenda = await request(app)
      .get("/agenda-publica")
      .query({
        slug,
        servicoId: servico.id,
        profissionalId: profissional.id
      });

    expect(agenda.statusCode).toBe(200);

    const diaComHorario = agenda.body.disponibilidade.find(
      dia => dia.horarios.length > 0
    );

    expect(diaComHorario).toBeTruthy();

    const horario = diaComHorario.horarios[0];

    const agendamento = await request(app)
      .post("/agendamentos")
      .send({
        slug,
        servico_id: servico.id,
        profissional_id: profissional.id,
        data: diaComHorario.data,
        horario,
        cliente_nome: "Cliente Teste",
        cliente_whatsapp: `62999${Date.now()}`
      });

    expect(agendamento.statusCode).toBe(201);
    expect(agendamento.body).toHaveProperty("agendamento");
  });
});