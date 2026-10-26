jest.setTimeout(30000);
jest.mock("../src/utils/uploadCloudinary", () => {
  const upload = jest.fn(); upload.remover = jest.fn().mockResolvedValue(); return upload;
});
const db = require("../src/db/db");
const upload = require("../src/utils/uploadCloudinary");
const service = require("../src/services/configuracoesService");
const repo = require("../src/repositories/configuracoesRepository");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: "image/jpeg", size: 4 };
let a; let args;
beforeEach(async () => {
  jest.clearAllMocks();
  upload.mockResolvedValue({ public_id: "foto-nova", secure_url: "https://images.example.test/nova.jpg" });
  a = await criarCenarioAgendamento(db, { prefixo: "business-photo-consistency" });
  args = { usuarioId: a.profissional.id, negocioId: a.negocioId };
  await db.query(`UPDATE negocios SET cep='01001000', estado='SP', cidade='São Paulo', bairro='Centro',
    endereco='Rua local', numero='20', localizacao_url='https://maps.google.com/', areas=ARRAY['Unhas'],
    foto_url='https://images.example.test/antiga.jpg', foto_public_id='foto-antiga' WHERE id=$1`, [a.negocioId]);
});
afterEach(async () => { jest.restoreAllMocks(); await removerCenarioAgendamento(db, a); });
afterAll(() => db.end());
async function photo() { return (await db.query("SELECT foto_url,foto_public_id FROM negocios WHERE id=$1", [a.negocioId])).rows[0]; }
test("perfil simultâneo ao upload mantém URL e identificador da foto nova", async () => {
  const original = repo.atualizarNegocio;
  jest.spyOn(repo, "atualizarNegocio").mockImplementationOnce(async (...params) => {
    await service.enviarFotoNegocio({ ...args, arquivo: file });
    return original(...params);
  });
  const result = await service.salvarConfiguracoes({ ...args, dados: { descricao: "Descrição revisada" } });
  expect(await photo()).toEqual({ foto_url: "https://images.example.test/nova.jpg", foto_public_id: "foto-nova" });
  expect(result.negocio.descricao).toBe("Descrição revisada");
  expect(result.negocio.foto_url).toBe("https://images.example.test/nova.jpg");
  expect(upload.remover).toHaveBeenCalledWith("foto-antiga"); expect(upload.remover).not.toHaveBeenCalledWith("foto-nova");
});
test("commit confirmado com resposta perdida recupera a foto e não a exclui", async () => {
  const original = db.executarTransacao;
  jest.spyOn(db, "executarTransacao").mockImplementationOnce(async callback => {
    await original(callback); throw new Error("Confirmação perdida depois do commit");
  });
  const result = await service.enviarFotoNegocio({ ...args, arquivo: file });
  expect(result.negocio.foto_url).toBe("https://images.example.test/nova.jpg");
  expect((await photo()).foto_public_id).toBe("foto-nova"); expect(upload.remover).not.toHaveBeenCalledWith("foto-nova");
});
test("consulta indisponível após commit incerto preserva o asset confirmado", async () => {
  const original = db.executarTransacao;
  jest.spyOn(db, "executarTransacao").mockImplementationOnce(async callback => {
    await original(callback);
    jest.spyOn(repo, "buscarNegocioPorId").mockRejectedValueOnce(new Error("Leitura indisponível"));
    throw new Error("Confirmação perdida");
  });
  await expect(service.enviarFotoNegocio({ ...args, arquivo: file })).rejects.toThrow("Confirmação perdida");
  expect((await photo()).foto_public_id).toBe("foto-nova"); expect(upload.remover).not.toHaveBeenCalled();
});
test("escrita que falhou antes de persistir remove somente o asset sem referência", async () => {
  jest.spyOn(repo, "atualizarFotoNegocio").mockRejectedValueOnce(new Error("Escrita recusada"));
  await expect(service.enviarFotoNegocio({ ...args, arquivo: file })).rejects.toThrow("Escrita recusada");
  expect((await photo()).foto_public_id).toBe("foto-antiga");
  expect(upload.remover).toHaveBeenCalledWith("foto-nova"); expect(upload.remover).not.toHaveBeenCalledWith("foto-antiga");
});
test("sem leitura de referências a limpeza conserva a imagem", async () => {
  jest.spyOn(repo, "atualizarFotoNegocio").mockRejectedValueOnce(new Error("Escrita recusada"));
  jest.spyOn(repo, "fotoEstaReferenciada").mockRejectedValueOnce(new Error("Referências indisponíveis"));
  await expect(service.enviarFotoNegocio({ ...args, arquivo: file })).rejects.toThrow("Escrita recusada");
  expect(upload.remover).not.toHaveBeenCalled();
});
