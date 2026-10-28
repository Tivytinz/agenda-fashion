const servicosRepository = require("../repositories/servicosRepository");
const { createHash } = require("crypto");
const criacaoTentativaRepository = require("../repositories/servicoCriacaoTentativaRepository");
const profissionalServicosRepository = require(
  "../repositories/profissionalServicosRepository"
);
const uploadToCloudinary = require("../utils/uploadCloudinary");
const db = require("../db/db");
const registrador = require("../utils/registrador");
const { normalizarCategoriaServico } = require("../domain/catalogoCategorias");
const {
  especialidadeDaCategoria,
} = require("../domain/especialidadesNegocio");
const {
  buscarUsoPlano,
  criarErroLimite
} = require("./planoService");

function criarErro(mensagem, statusCode) {
  const err = new Error(mensagem);
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

async function obterVinculoDono(usuarioId, mensagem) {
  const vinculo = await servicosRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    throw criarErro(mensagem, 403);
  }

  return vinculo;
}

async function listarServicos(usuarioId) {
  const vinculo = await servicosRepository.buscarNegocioUsuario(usuarioId);

  if (!vinculo) {
    return [];
  }

  await buscarUsoPlano(vinculo.negocio_id);

  return servicosRepository.listarServicos(vinculo.negocio_id);
}

function normalizarDescricao(descricao) {
  const valor = String(descricao || "").trim();

  if (valor.length > 1200) {
    throw criarErro("A descrição pode ter no máximo 1200 caracteres.", 400);
  }

  return valor || null;
}

function normalizarAtivo(ativo, padrao = true) {
  return typeof ativo === "boolean" ? ativo : padrao;
}

function normalizarValor(valor) {
  const numero =
    valor === undefined ||
    valor === null ||
    valor === ""
      ? 0
      : Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0 ||
    numero > 9999999999.99
  ) {
    throw criarErro("Valor do serviço inválido.", 400);
  }

  return numero;
}

function normalizarDuracao(duracaoMinutos) {
  const numero = Number(duracaoMinutos);

  if (
    !Number.isInteger(numero) ||
    numero < 5 ||
    numero > 1440
  ) {
    throw criarErro(
      "A duração deve ser um número inteiro entre 5 e 1440 minutos.",
      400
    );
  }

  return numero;
}

function normalizarNome(nome) {
  const valor = String(nome ?? "")
    .replace(/^[\s•·▪◦]+/u, "")
    .trim();

  if (valor.length < 2 || valor.length > 120) {
    throw criarErro("Nome do serviço inválido.", 400);
  }

  return valor;
}

async function validarLimiteServicoAtivo(negocioId, executor) {
  await servicosRepository.bloquearCadastroServico(executor, negocioId);

  const uso = await buscarUsoPlano(negocioId, executor);

  if (!uso) {
    throw criarErro("Plano do negócio não encontrado.", 404);
  }

  const utilizados = await servicosRepository.contarServicosAtivos(
    negocioId,
    executor
  );
  const limite = uso.limite_servicos;
  const planoNome = uso.plano_nome || "plano atual";

  if (limite !== null && utilizados >= Number(limite)) {
    const limiteNumerico = Number(limite);
    const acimaDoLimite = Math.max(0, utilizados - limiteNumerico);
    const mensagem = acimaDoLimite > 0
      ? `Você possui ${utilizados} serviço(s) ativo(s), ${acimaDoLimite} acima do limite de ${limiteNumerico} do plano ${planoNome}. Faça upgrade para adicionar novos serviços.`
      : `Você atingiu o limite de ${limiteNumerico} serviço(s) do plano ${planoNome}. Faça upgrade para cadastrar mais.`;

    throw criarErroLimite(
      mensagem,
      "LIMITE_SERVICOS",
      {
        plano_nome: planoNome,
        utilizados,
        limite: limiteNumerico,
        acima_do_limite: acimaDoLimite,
      }
    );
  }
}

function normalizarChaveTentativa(valor, obrigatoria = false) {
  const chave = valor == null ? null : String(valor).trim();
  if ((obrigatoria && chave === null) || (chave !== null && (
    chave.length < 16 || chave.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(chave)
  ))) {
    throw criarErro("Identificação da tentativa de cadastro inválida.", 400);
  }
  return chave;
}

function normalizarNegocioAlvo(valor, obrigatorio = false) {
  if (valor == null && !obrigatorio) return null;
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw criarErro("Identifique o negócio deste cadastro. Atualize a página para continuar.", 400);
  }
  return id;
}

async function exigirContextoDonoNaTransacao(usuarioId, negocioId, client, options) {
  const contexto = await servicosRepository.bloquearContextoDono(usuarioId, negocioId, client, options);
  if (!contexto) throw criarErro("Apenas a dona ativa deste negócio pode cadastrar ou recuperar serviços.", 403);
}

async function recuperarServicoDaTentativa(tentativa, negocioId, client) {
  const servico = tentativa.servico_id && await servicosRepository.buscarServicoDoNegocio(
    tentativa.servico_id, negocioId, client
  );
  if (!servico) {
    const erro = criarErro("O serviço desta tentativa foi removido. Volte aos serviços para continuar.", 410);
    erro.codigo = "SERVICO_TENTATIVA_REMOVIDA";
    throw erro;
  }
  return { servico, publicacao: await criacaoTentativaRepository.buscarPublicacao(negocioId, client) };
}

async function consultarTentativaCriacao({ usuarioId, negocioId, chaveIdempotencia }) {
  const chave = normalizarChaveTentativa(chaveIdempotencia, true);
  const alvo = normalizarNegocioAlvo(negocioId, true);
  return db.executarTransacao(async (client) => {
    await exigirContextoDonoNaTransacao(usuarioId, alvo, client);
    const tentativa = await criacaoTentativaRepository.buscar({
      negocioId: alvo, usuarioId, chaveIdempotencia: chave,
    }, client);
    // Ausência não cancela um POST que ainda não chegou: o cliente deve manter
    // a mesma chave ao preencher novamente, sem inferir falha definitiva.
    if (!tentativa) return { estado: "nao_encontrada" };
    return { estado: "concluida", ...await recuperarServicoDaTentativa(tentativa, alvo, client) };
  });
}

async function criarServico({
  usuarioId,
  negocioId,
  nome,
  descricao,
  valor,
  duracaoMinutos,
  categoria,
  ativo,
  chaveIdempotencia
}) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode criar serviços."
  );

  const servicoAtivo = normalizarAtivo(ativo);
  const nomeNormalizado = normalizarNome(nome);
  const valorNormalizado = normalizarValor(valor);
  const duracaoNormalizada = normalizarDuracao(duracaoMinutos);
  const categoriaNormalizada = normalizarCategoriaServico(categoria || "outro");
  const descricaoNormalizada = normalizarDescricao(descricao);
  const chave = normalizarChaveTentativa(chaveIdempotencia);
  const alvo = normalizarNegocioAlvo(negocioId, chave !== null) || vinculo.negocio_id;
  if (Number(alvo) !== Number(vinculo.negocio_id)) {
    throw criarErro("Apenas a dona ativa deste negócio pode cadastrar ou recuperar serviços.", 403);
  }
  const requestHash = createHash("sha256").update(JSON.stringify({
    nome: nomeNormalizado, descricao: descricaoNormalizada, valor: valorNormalizado,
    duracaoMinutos: duracaoNormalizada, categoria: categoriaNormalizada, ativo: servicoAtivo,
  })).digest("hex");
  const resultado = await db.executarTransacao(async (client) => {
    await exigirContextoDonoNaTransacao(usuarioId, alvo, client, { capacidade: servicoAtivo });
    const tentativa = chave === null ? null : await criacaoTentativaRepository.iniciar({
      negocioId: alvo, usuarioId, chaveIdempotencia: chave, requestHash,
    }, client);
    if (tentativa) {
      if (tentativa.request_hash !== requestHash) {
        const erro = criarErro("Esta tentativa já foi usada com outros dados de serviço. Verifique o cadastro para continuar.", 409);
        erro.codigo = "SERVICO_TENTATIVA_DIVERGENTE";
        throw erro;
      }
      if (tentativa.concluida_em) {
        return recuperarServicoDaTentativa(tentativa, alvo, client);
      }
    } else if (chave !== null) {
      throw criarErro("Não foi possível recuperar a tentativa de cadastro. Tente novamente.", 503);
    }
    if (servicoAtivo) {
      await validarLimiteServicoAtivo(alvo, client);
    }

    const criado = await servicosRepository.criarServico(
      {
        negocioId: alvo,
        nome: nomeNormalizado,
        descricao: descricaoNormalizada,
        valor: valorNormalizado,
        duracaoMinutos: duracaoNormalizada,
        categoria: categoriaNormalizada,
        ativo: servicoAtivo,
      },
      client
    );

    await profissionalServicosRepository
      .habilitarServicoProfissional({
        negocioId:
          alvo,
        profissionalId:
          Number(usuarioId),
        servicoId:
          criado.id,
        habilitadoPorUsuarioId:
          Number(usuarioId),
        executor:
          client,
      });

    await servicosRepository.adicionarEspecialidadeNegocio(
      alvo,
      especialidadeDaCategoria(categoriaNormalizada),
      client
    );

    const publicacao = await servicosRepository
      .sincronizarPublicacaoAutomatica(
        alvo,
        client
      );

    if (tentativa) await criacaoTentativaRepository.concluir(tentativa.id, criado.id, client);
    return { servico: criado, publicacao };
  });

  return {
    mensagem: resultado.publicacao?.publicado
      ? "Serviço criado e negócio publicado com sucesso."
      : "Serviço criado com sucesso.",
    servico: resultado.servico,
    publicacao: resultado.publicacao,
  };
}

async function editarServico({
  usuarioId,
  id,
  nome,
  descricao,
  valor,
  duracaoMinutos,
  categoria,
  ativo
}) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode editar serviços."
  );

  const nomeNormalizado = normalizarNome(nome);
  const valorNormalizado = normalizarValor(valor);
  const duracaoNormalizada = normalizarDuracao(duracaoMinutos);

  const servico = await db.executarTransacao(async (client) => {
    const atual = await servicosRepository.buscarServicoDoNegocio(
      id,
      vinculo.negocio_id,
      client
    );

    if (!atual) return null;

    const servicoAtivo = normalizarAtivo(ativo, atual.ativo !== false);
    if (atual.ativo === false && servicoAtivo) {
      await validarLimiteServicoAtivo(vinculo.negocio_id, client);
    }

    const categoriaNormalizada = normalizarCategoriaServico(
      categoria === undefined ? atual.categoria : categoria,
      { obrigatoria: categoria !== undefined || Boolean(atual.categoria) }
    );

    const atualizado = await servicosRepository.editarServico({
      id,
      negocioId: vinculo.negocio_id,
      nome: nomeNormalizado,
      descricao: normalizarDescricao(descricao),
      valor: valorNormalizado,
      duracaoMinutos: duracaoNormalizada,
      categoria: categoriaNormalizada,
      ativo: servicoAtivo,
    }, client);

    if (atualizado) {
      await servicosRepository.adicionarEspecialidadeNegocio(
        vinculo.negocio_id,
        especialidadeDaCategoria(categoriaNormalizada),
        client
      );

      await servicosRepository.sincronizarPublicacaoAutomatica(
        vinculo.negocio_id,
        client
      );
    }

    return atualizado;
  });

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  return {
    mensagem: "Serviço atualizado com sucesso.",
    servico,
  };
}

async function removerServico({ usuarioId, id }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode remover serviços."
  );

  const servicoAtual =
    await servicosRepository
      .buscarServicoDoNegocio(
        id,
        vinculo.negocio_id
      );

  if (!servicoAtual) {
    throw criarErro(
      "Serviço não encontrado.",
      404
    );
  }

  const fotos =
    await servicosRepository
      .listarFotosServico(id);

  const removido = await db.executarTransacao(
    async (client) => {
      const resultado =
        await servicosRepository.removerServico({
          id,
          negocioId: vinculo.negocio_id,
        }, client);

      if (resultado) {
        await servicosRepository.sincronizarPublicacaoAutomatica(
          vinculo.negocio_id,
          client
        );
      }

      return resultado;
    }
  );

  if (!removido) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  const imagens =
    new Set([
      servicoAtual
        .foto_public_id,
      ...(fotos || [])
        .map(
          (foto) =>
            foto.foto_public_id
        ),
    ]);

  for (
    const publicId
    of imagens
  ) {
    await removerImagemSilenciosamente(
      publicId
    );
  }

  return {
    mensagem: "Serviço removido com sucesso.",
  };
}

async function removerFotoCapaAnteriorSeOrfa({ servicoId, fotoPublicId }) {
  if (!fotoPublicId) return;

  const usadaNaGaleria = await servicosRepository.fotoGaleriaUsaPublicId({
    servicoId,
    fotoPublicId,
  });

  if (!usadaNaGaleria) {
    await removerImagemSilenciosamente(fotoPublicId);
  }
}

async function removerFotoServicoNaoReferenciada(publicId) {
  if (!publicId) return;
  try {
    if (!await servicosRepository.fotoEstaReferenciada(publicId)) {
      await removerImagemSilenciosamente(publicId);
    }
  } catch { /* Falha de leitura não comprova que a imagem esteja sem uso. */ }
}

async function enviarFotoServico({ usuarioId, id, file }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode alterar foto do serviço."
  );

  if (!file) {
    throw criarErro("Nenhuma imagem enviada.", 400);
  }

  const servicoAtual =
    await servicosRepository
      .buscarServicoDoNegocio(
        id,
        vinculo.negocio_id
      );

  if (!servicoAtual) {
    throw criarErro(
      "Serviço não encontrado.",
      404
    );
  }

  const resultado =
    await validarResultadoUpload(
      await uploadToCloudinary(
        file.buffer,
        "saas-agendamento/servicos"
      )
    );

  let servico;
  let capaAnterior;

  try {
    servico = await db.executarTransacao(async client => {
      // HTTP já concluiu. Revalidar o mesmo alvo, sem adotar um novo negócio,
      // e serializar com edição, escolha de capa e arquivamento.
      if (!await servicosRepository.bloquearContextoDono(usuarioId, vinculo.negocio_id, client, { servicoId: id })) {
        throw criarErro("Serviço não encontrado ou negócio indisponível.", 404);
      }
      const atual = await servicosRepository.buscarServicoDoNegocio(id, vinculo.negocio_id, client);
      capaAnterior = atual.foto_public_id;
      const atualizado = await servicosRepository.atualizarFotoServico({
        id, negocioId: vinculo.negocio_id,
        fotoUrl: resultado.fotoUrl, fotoPublicId: resultado.fotoPublicId,
      }, client);
      if (!atualizado) throw criarErro("Serviço não encontrado.", 404);
      return atualizado;
    });
  } catch (erro) {
    // O COMMIT pode ter ocorrido antes da perda da confirmação. Conferir a
    // referência canônica antes de limpar; indisponibilidade preserva o asset.
    try {
      const confirmado = await servicosRepository.buscarServicoDoNegocio(id, vinculo.negocio_id);
      if (confirmado?.foto_public_id === resultado.fotoPublicId && confirmado.foto_url === resultado.fotoUrl) {
        servico = confirmado;
      } else {
        await removerFotoServicoNaoReferenciada(resultado.fotoPublicId);
      }
    } catch { /* Não apagar uma imagem possivelmente salva. */ }
    if (!servico) throw erro;
  }

  if (capaAnterior && capaAnterior !== resultado.fotoPublicId) {
    await removerFotoServicoNaoReferenciada(capaAnterior);
  }

  return {
    mensagem: "Foto do serviço atualizada.",
    servico,
  };
}

async function listarFotosServico({ usuarioId, id }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode listar fotos do serviço."
  );

  const servico =
    await servicosRepository.buscarServicoDoNegocio(
      id,
      vinculo.negocio_id
    );

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  const fotos = await servicosRepository.listarFotosServico(id);

  return { fotos };
}

async function adicionarFotoGaleriaServico({ usuarioId, id, file }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode adicionar fotos ao serviço."
  );

  if (!file) {
    throw criarErro("Nenhuma imagem enviada.", 400);
  }

  const servico = await servicosRepository.buscarServicoDoNegocio(
    id,
    vinculo.negocio_id
  );

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  const resultado =
    await validarResultadoUpload(
      await uploadToCloudinary(
        file.buffer,
        "saas-agendamento/servicos/galeria"
      )
    );

  let foto;

  try {
    foto =
      await servicosRepository
        .adicionarFotoGaleriaServico({
          servicoId: id,
          fotoUrl:
            resultado.fotoUrl,
          fotoPublicId:
            resultado.fotoPublicId,
        });
  } catch (erro) {
    await removerImagemSilenciosamente(
      resultado.fotoPublicId
    );

    throw erro;
  }

  return {
    mensagem: "Foto adicionada à galeria.",
    foto,
  };
}

async function definirFotoCapaServico({ usuarioId, id, fotoId }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode escolher a foto principal do serviço."
  );

  const { servico, anterior } = await db.executarTransacao(async client => {
    if (!await servicosRepository.bloquearContextoDono(usuarioId, vinculo.negocio_id, client, { servicoId: id })) {
      throw criarErro("Serviço não encontrado ou negócio indisponível.", 404);
    }
    const servicoAtual = await servicosRepository.buscarServicoDoNegocio(id, vinculo.negocio_id, client);
    const foto = await servicosRepository.buscarFotoGaleriaDoNegocio({
      fotoId, negocioId: vinculo.negocio_id, bloquear: true,
    }, client);
    if (!foto || Number(foto.servico_id) !== Number(id)) {
      throw criarErro("Foto da galeria não encontrada para este serviço.", 404);
    }
    const atualizado = await servicosRepository.atualizarFotoServico({
      id, negocioId: vinculo.negocio_id, fotoUrl: foto.foto_url, fotoPublicId: foto.foto_public_id,
    }, client);
    if (!atualizado) throw criarErro("Serviço não encontrado.", 404);
    return { servico: atualizado, anterior: servicoAtual.foto_public_id };
  });
  if (anterior && anterior !== servico.foto_public_id) {
    await removerFotoCapaAnteriorSeOrfa({
      servicoId: id,
      fotoPublicId: anterior,
    });
  }

  return {
    mensagem: "Foto escolhida como capa do serviço.",
    servico,
  };
}

async function removerFotoGaleriaServico({ usuarioId, fotoId }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode remover fotos do serviço."
  );

  // A primeira leitura só seleciona o serviço a bloquear. A foto é relida
  // após os locks; uma seleção obsoleta não autoriza a remoção.
  const alvo = await servicosRepository.buscarFotoGaleriaDoNegocio({ fotoId, negocioId: vinculo.negocio_id });
  if (!alvo) throw criarErro("Foto não encontrada.", 404);
  const resultado = await db.executarTransacao(async (client) => {
    if (!await servicosRepository.bloquearContextoDono(usuarioId, vinculo.negocio_id, client, { servicoId: alvo.servico_id })) {
      throw criarErro("Serviço não encontrado ou negócio indisponível.", 404);
    }
    const foto = await servicosRepository.buscarFotoGaleriaDoNegocio(
      { fotoId, negocioId: vinculo.negocio_id, bloquear: true },
      client
    );

    if (!foto || Number(foto.servico_id) !== Number(alvo.servico_id)) return null;

    const capaRemovida = await servicosRepository.limparFotoServicoSeUsarPublicId(
      {
        id: foto.servico_id,
        negocioId: vinculo.negocio_id,
        fotoPublicId: foto.foto_public_id,
      },
      client
    );

    const removida = await servicosRepository.removerFotoGaleriaServico(
      { fotoId, negocioId: vinculo.negocio_id },
      client
    );

    return removida
      ? { removida, capaRemovida: Boolean(capaRemovida) }
      : null;
  });

  if (!resultado?.removida) {
    throw criarErro("Foto não encontrada.", 404);
  }

  await removerImagemSilenciosamente(
    resultado.removida.foto_public_id
  );

  return {
    mensagem: "Foto removida da galeria.",
    capa_removida: resultado.capaRemovida,
    servico_id: resultado.removida.servico_id,
  };
}

async function removerImagemSilenciosamente(
  publicId
) {
  if (
    typeof uploadToCloudinary
      .remover !==
    "function" ||
    !publicId
  ) {
    return;
  }

  try {
    await uploadToCloudinary
      .remover(publicId);
  } catch (erro) {
    registrador.aviso(
      "[Cloudinary] Não foi possível remover uma imagem órfã de serviço.",
      {
        public_id:
          publicId,
        erro:
          erro?.message,
      }
    );
  }
}

async function validarResultadoUpload(
  resultado
) {
  const fotoUrl =
    String(
      resultado?.secure_url ||
      resultado?.url ||
      ""
    ).trim();

  const fotoPublicId =
    String(
      resultado?.public_id ||
      ""
    ).trim();

  if (
    fotoUrl &&
    fotoPublicId
  ) {
    return {
      fotoUrl,
      fotoPublicId,
    };
  }

  await removerImagemSilenciosamente(
    fotoPublicId
  );

  throw criarErro(
    "O provedor de imagens retornou uma resposta inválida.",
    502
  );
}

module.exports = {
  listarServicos,
  consultarTentativaCriacao,
  criarServico,
  editarServico,
  removerServico,
  enviarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  definirFotoCapaServico,
  removerFotoGaleriaServico,
};
