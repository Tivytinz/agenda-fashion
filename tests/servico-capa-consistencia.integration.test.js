jest.setTimeout(30000);
jest.mock("../src/utils/uploadCloudinary", () => {
  const upload = jest.fn(); upload.remover = jest.fn().mockResolvedValue(); return upload;
});
const db = require("../src/db/db");
const upload = require("../src/utils/uploadCloudinary");
const repo = require("../src/repositories/servicosRepository");
const service = require("../src/services/servicosService");
const gallery = require("../src/services/servicoFotoUploadService");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
let a; let b; let photo;
beforeEach(async () => {
  jest.clearAllMocks(); upload.mockResolvedValue({ public_id: "capa-da-galeria", secure_url: "https://images.example.test/capa.jpg" });
  a = await criarCenarioAgendamento(db, { prefixo: "cover-consistency" });
  b = await criarCenarioAgendamento(db, { prefixo: "cover-other" });
  photo = (await gallery.adicionar({ usuarioId: a.profissional.id, id: a.servico.id,
    chaveIdempotencia: "capa-foto-galeria-tentativa-0001", file: { buffer: Buffer.from("image"), mimetype: "image/jpeg" } })).foto;
});
afterEach(async () => { jest.restoreAllMocks(); await removerCenarioAgendamento(db, a); await removerCenarioAgendamento(db, b); });
afterAll(() => db.end());
function choose(usuarioId = a.profissional.id) {
  return service.definirFotoCapaServico({ usuarioId, id: a.servico.id, fotoId: photo.id });
}
function remove() { return service.removerFotoGaleriaServico({ usuarioId: a.profissional.id, fotoId: photo.id }); }
async function state() { return (await db.query("SELECT foto_url,foto_public_id FROM servicos_negocio WHERE id=$1", [a.servico.id])).rows[0]; }
test("escolher e depois remover limpa atomicamente a capa e conserva o recibo terminal", async () => {
  expect((await choose()).servico.foto_public_id).toBe(photo.foto_public_id);
  expect((await remove()).capa_removida).toBe(true);
  expect(await state()).toEqual({ foto_url: null, foto_public_id: null });
  await expect(gallery.consultar({ usuarioId: a.profissional.id, id: a.servico.id, chaveIdempotencia: "capa-foto-galeria-tentativa-0001" })).rejects.toMatchObject({ status: 410 });
  expect(upload.remover).toHaveBeenCalledWith(photo.foto_public_id);
});
test("remover antes de escolher recusa a capa inexistente", async () => {
  await remove(); await expect(choose()).rejects.toMatchObject({ status: 404 });
  expect(await state()).toEqual({ foto_url: null, foto_public_id: null });
  expect(upload.remover).toHaveBeenCalledTimes(1);
});
test("escolha entre a seleção inicial da remoção e sua transação é limpa pela releitura", async () => {
  const original = repo.buscarFotoGaleriaDoNegocio;
  jest.spyOn(repo, "buscarFotoGaleriaDoNegocio").mockImplementationOnce(async (...args) => {
    const snapshot = await original(...args);
    await choose();
    return snapshot;
  });
  expect((await remove()).capa_removida).toBe(true);
  expect(await state()).toEqual({ foto_url: null, foto_public_id: null });
});
test("remoção concorrente já concluída não limpa o asset duas vezes", async () => {
  const original = repo.buscarFotoGaleriaDoNegocio;
  jest.spyOn(repo, "buscarFotoGaleriaDoNegocio").mockImplementationOnce(async (...args) => {
    const snapshot = await original(...args); await remove(); return snapshot;
  });
  await expect(remove()).rejects.toMatchObject({ status: 404 });
  expect(upload.remover).toHaveBeenCalledTimes(1);
});
test("outra dona não escolhe nem remove a foto", async () => {
  await expect(choose(b.profissional.id)).rejects.toMatchObject({ status: 404 });
  await expect(service.removerFotoGaleriaServico({ usuarioId: b.profissional.id, fotoId: photo.id })).rejects.toMatchObject({ status: 404 });
  expect(upload.remover).not.toHaveBeenCalled(); expect((await state()).foto_url).toBeNull();
});
test("arquivamento após resolver o vínculo impede a escolha de capa", async () => {
  const original = repo.buscarNegocioDono;
  jest.spyOn(repo, "buscarNegocioDono").mockImplementationOnce(async (...args) => {
    const snapshot = await original(...args);
    await require("../src/services/encerramentoService").encerrarNegocio({ usuarioId: a.profissional.id, negocioId: a.negocioId });
    return snapshot;
  });
  await expect(choose()).rejects.toMatchObject({ status: 404 });
  expect((await state()).foto_url).toBeNull(); expect(upload.remover).not.toHaveBeenCalled();
});

// Requer PostgreSQL nativo com conexões independentes. PGlite não comprova waits.
const nativeTest = Number(process.env.DB_POOL_MAX || 10) >= 3 ? test : test.skip;
nativeTest("remoção concorrente aguarda a escolha da capa e não deixa referência apagada", async () => {
  let selected; let release;
  const selectedPromise = new Promise(resolve => { selected = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const original = repo.buscarFotoGaleriaDoNegocio;
  let paused = false;
  jest.spyOn(repo, "buscarFotoGaleriaDoNegocio").mockImplementation(async (args, client) => {
    const row = await original(args, client);
    if (args.bloquear && !paused) { paused = true; selected(); await barrier; }
    return row;
  });
  const choosing = choose();
  let removing;
  try {
    await selectedPromise;
    removing = remove();
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_locks l INNER JOIN pg_stat_activity a ON a.pid=l.pid
          WHERE l.granted=FALSE AND a.datname=current_database()
            AND a.query LIKE '%FROM usuarios%' AND a.query LIKE '%FOR NO KEY UPDATE%'
        ) AS waiting
      `);
      if (result.rows[0].waiting) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(true);
  } finally { release(); await Promise.allSettled([choosing, removing].filter(Boolean)); }
  expect((await choosing).servico.foto_public_id).toBe(photo.foto_public_id);
  expect((await removing).capa_removida).toBe(true);
  expect(await state()).toEqual({ foto_url: null, foto_public_id: null });
});
