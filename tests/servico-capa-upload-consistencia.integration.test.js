jest.setTimeout(30000);
jest.mock("../src/utils/uploadCloudinary", () => {
  const upload = jest.fn();
  upload.remover = jest.fn().mockResolvedValue();
  return upload;
});
const db = require("../src/db/db");
const upload = require("../src/utils/uploadCloudinary");
const repo = require("../src/repositories/servicosRepository");
const service = require("../src/services/servicosService");
const { encerrarNegocio } = require("../src/services/encerramentoService");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: "image/jpeg", size: 4 };
const oldPhoto = { foto_url: "https://images.example.test/antiga.jpg", foto_public_id: "capa-antiga" };
const newPhoto = { foto_url: "https://images.example.test/nova.jpg", foto_public_id: "capa-nova" };
let scenario;
beforeEach(async () => {
  jest.clearAllMocks();
  upload.mockResolvedValue({ public_id: newPhoto.foto_public_id, secure_url: newPhoto.foto_url });
  scenario = await criarCenarioAgendamento(db, { prefixo: "cover-upload-consistency" });
  await db.query("UPDATE servicos_negocio SET foto_url=$2,foto_public_id=$3 WHERE id=$1",
    [scenario.servico.id, oldPhoto.foto_url, oldPhoto.foto_public_id]);
});
afterEach(async () => { jest.restoreAllMocks(); await removerCenarioAgendamento(db, scenario); });
afterAll(() => db.end());
function send() {
  return service.enviarFotoServico({ usuarioId: scenario.profissional.id, id: scenario.servico.id, file });
}
async function photo() {
  return (await db.query("SELECT foto_url,foto_public_id FROM servicos_negocio WHERE id=$1", [scenario.servico.id])).rows[0];
}

test("confirmação perdida depois do COMMIT recupera a capa sem apagar o asset salvo", async () => {
  const original = db.executarTransacao;
  jest.spyOn(db, "executarTransacao").mockImplementationOnce(async callback => {
    await original(callback);
    throw Object.assign(new Error("Confirmação do COMMIT perdida"), { code: "ECONNRESET" });
  });
  expect((await send()).servico).toMatchObject(newPhoto);
  expect(await photo()).toEqual(newPhoto);
  expect(upload).toHaveBeenCalledTimes(1);
  expect(upload.remover).toHaveBeenCalledWith(oldPhoto.foto_public_id);
  expect(upload.remover).not.toHaveBeenCalledWith(newPhoto.foto_public_id);
});

test("leitura indisponível depois de COMMIT incerto conserva a imagem possivelmente salva", async () => {
  const original = db.executarTransacao;
  jest.spyOn(db, "executarTransacao").mockImplementationOnce(async callback => {
    await original(callback);
    jest.spyOn(repo, "buscarServicoDoNegocio").mockRejectedValueOnce(new Error("Leitura indisponível"));
    throw new Error("Confirmação perdida");
  });
  await expect(send()).rejects.toThrow("Confirmação perdida");
  expect(await photo()).toEqual(newPhoto);
  expect(upload.remover).not.toHaveBeenCalled();
});

test("falha depois do UPDATE e antes do COMMIT reverte a capa e limpa somente o upload sem uso", async () => {
  const original = repo.atualizarFotoServico;
  jest.spyOn(repo, "atualizarFotoServico").mockImplementationOnce(async (...args) => {
    await original(...args);
    throw new Error("Conexão interrompida antes do COMMIT");
  });
  await expect(send()).rejects.toThrow("Conexão interrompida antes do COMMIT");
  expect(await photo()).toEqual(oldPhoto);
  expect(upload.remover.mock.calls).toEqual([[newPhoto.foto_public_id]]);
});

test("falha na consulta de referências impede uma limpeza sem evidência", async () => {
  jest.spyOn(repo, "atualizarFotoServico").mockRejectedValueOnce(new Error("Escrita recusada"));
  jest.spyOn(repo, "fotoEstaReferenciada").mockRejectedValueOnce(new Error("Referências indisponíveis"));
  await expect(send()).rejects.toThrow("Escrita recusada");
  expect(await photo()).toEqual(oldPhoto);
  expect(upload.remover).not.toHaveBeenCalled();
});

test("capa anterior mantida na galeria não é removida do provedor", async () => {
  await repo.adicionarFotoGaleriaServico({ servicoId: scenario.servico.id,
    fotoUrl: oldPhoto.foto_url, fotoPublicId: oldPhoto.foto_public_id });
  await send();
  expect(await photo()).toEqual(newPhoto);
  expect(upload.remover).not.toHaveBeenCalled();
});

test("finalização relê a capa alterada durante HTTP e limpa a imagem efetivamente substituída", async () => {
  upload.mockImplementationOnce(async () => {
    await db.query("UPDATE servicos_negocio SET foto_public_id='capa-intermediaria' WHERE id=$1", [scenario.servico.id]);
    return { public_id: newPhoto.foto_public_id, secure_url: newPhoto.foto_url };
  });
  await send();
  expect(await photo()).toEqual(newPhoto);
  expect(upload.remover.mock.calls).toEqual([["capa-intermediaria"]]);
});

test("arquivamento confirmado durante HTTP impede a gravação e limpa o novo upload", async () => {
  upload.mockImplementationOnce(async () => {
    await encerrarNegocio({ usuarioId: scenario.profissional.id, negocioId: scenario.negocioId });
    return { public_id: newPhoto.foto_public_id, secure_url: newPhoto.foto_url };
  });
  await expect(send()).rejects.toMatchObject({ status: 404 });
  expect(await photo()).toEqual(oldPhoto);
  const business = (await db.query("SELECT ativo,arquivado_em FROM negocios WHERE id=$1", [scenario.negocioId])).rows[0];
  expect(business.ativo).toBe(false);
  expect(business.arquivado_em).not.toBeNull();
  expect(upload.remover.mock.calls).toEqual([[newPhoto.foto_public_id]]);
});

test.each(["conta", "vínculo", "serviço"])("perda de %s durante HTTP impede finalizar a capa", async target => {
  upload.mockImplementationOnce(async () => {
    if (target === "conta") await db.query("UPDATE usuarios SET ativo=FALSE WHERE id=$1", [scenario.profissional.id]);
    else if (target === "vínculo") await db.query("UPDATE usuarios_negocios SET ativo=FALSE WHERE usuario_id=$1 AND negocio_id=$2",
      [scenario.profissional.id, scenario.negocioId]);
    else await db.query("DELETE FROM servicos_negocio WHERE id=$1", [scenario.servico.id]);
    return { public_id: newPhoto.foto_public_id, secure_url: newPhoto.foto_url };
  });
  await expect(send()).rejects.toMatchObject({ status: 404 });
  expect(target === "serviço" ? await photo() : (await photo()).foto_public_id)
    .toBe(target === "serviço" ? undefined : oldPhoto.foto_public_id);
  expect(upload.remover.mock.calls).toEqual([[newPhoto.foto_public_id]]);
});
