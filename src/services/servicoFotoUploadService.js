const { createHash } = require("crypto");
const db = require("../db/db");
const servicosRepository = require("../repositories/servicosRepository");
const tentativas = require("../repositories/servicoFotoUploadRepository");
const upload = require("../utils/uploadCloudinary");
const registrador = require("../utils/registrador");

function erro(message, statusCode, codigo) {
  return Object.assign(new Error(message), { statusCode, status: statusCode, codigo });
}

function normalizarChave(value) {
  const chave = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,120}$/.test(chave)) {
    throw erro("Identificação do envio de foto inválida.", 400, "FOTO_TENTATIVA_INVALIDA");
  }
  return chave;
}

async function contexto({ usuarioId, id, chaveIdempotencia }) {
  const chave = normalizarChave(chaveIdempotencia);
  const vinculo = await servicosRepository.buscarNegocioDono(usuarioId);
  if (!vinculo) throw erro("Apenas a dona pode adicionar ou recuperar fotos do serviço.", 403);
  return { usuarioId, servicoId: id, negocioId: vinculo.negocio_id, chave };
}

async function lerNaTransacao(ctx, client, arquivoHash) {
  if (!await servicosRepository.bloquearContextoDono(ctx.usuarioId, ctx.negocioId, client)) {
    throw erro("O negócio não está disponível para este envio.", 403);
  }
  const servico = await servicosRepository.buscarServicoDoNegocio(ctx.servicoId, ctx.negocioId, client);
  if (!servico) throw erro("Serviço não encontrado.", 404);
  const tentativa = await tentativas.buscar(ctx, client);
  if (!tentativa) return null;
  if (arquivoHash && tentativa.arquivo_hash !== arquivoHash) {
    throw erro("Esta tentativa já foi usada para outra foto.", 409, "FOTO_TENTATIVA_DIVERGENTE");
  }
  const foto = tentativa.foto_id && await servicosRepository.buscarFotoGaleriaDoNegocio({
    fotoId: tentativa.foto_id, negocioId: ctx.negocioId,
  }, client);
  if (!foto) throw erro("A foto desta tentativa foi removida. Selecione outra foto para continuar.", 410, "FOTO_TENTATIVA_REMOVIDA");
  return { mensagem: "Foto adicionada à galeria.", foto };
}

async function consultar(args) {
  const ctx = await contexto(args);
  const result = await db.executarTransacao(client => lerNaTransacao(ctx, client));
  return result ? { estado: "concluida", ...result } : { estado: "nao_encontrada" };
}

async function removerDuplicata(publicId) {
  if (!publicId || typeof upload.remover !== "function") return;
  try { await upload.remover(publicId); }
  catch { registrador.aviso("[Cloudinary] Não foi possível limpar uma foto de serviço não utilizada.", { public_id: publicId }); }
}

async function adicionar({ file, ...args }) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw erro("Nenhuma imagem enviada.", 400);
  const ctx = await contexto(args);
  const arquivoHash = createHash("sha256").update(String(file.mimetype || "")).update(file.buffer).digest("hex");
  const ler = () => db.executarTransacao(client => lerNaTransacao(ctx, client, arquivoHash));
  const existente = await ler();
  if (existente) return existente;

  // HTTP permanece fora da transação. Finalizações concorrentes são
  // serializadas pelo contexto da dona e confirmam uma única foto por chave.
  const result = await upload(file.buffer, "saas-agendamento/servicos/galeria");
  const fotoUrl = String(result?.secure_url || result?.url || "").trim();
  const fotoPublicId = String(result?.public_id || "").trim();
  if (!fotoUrl || !fotoPublicId) {
    await removerDuplicata(fotoPublicId);
    throw erro("O provedor de imagens retornou uma resposta inválida.", 502);
  }

  let confirmado;
  let readyToCommit = false;
  try {
    confirmado = await db.executarTransacao(async client => {
      const replay = await lerNaTransacao(ctx, client, arquivoHash);
      if (replay) return replay;
      const foto = await servicosRepository.adicionarFotoGaleriaServico({
        servicoId: ctx.servicoId, fotoUrl, fotoPublicId,
      }, client);
      await tentativas.concluir({ ...ctx, arquivoHash, fotoId: foto.id }, client);
      readyToCommit = true;
      return { mensagem: "Foto adicionada à galeria.", foto };
    });
  } catch (failure) {
    if (!readyToCommit) {
      await removerDuplicata(fotoPublicId);
      throw failure;
    }
    // Uma falha de confirmação do COMMIT pode ter persistido a foto. Conferir
    // antes de limpar o asset; indisponibilidade de leitura preserva a imagem.
    try { confirmado = await ler(); }
    catch { throw failure; }
    if (!confirmado) {
      await removerDuplicata(fotoPublicId);
      throw failure;
    }
  }
  if (confirmado.foto.foto_public_id !== fotoPublicId) await removerDuplicata(fotoPublicId);
  return confirmado;
}

module.exports = { adicionar, consultar };
