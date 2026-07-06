const agendaPublicaRepository = require("../repositories/agendaPublicaRepository");

function gerarDiasProximos(qtd = 7) {
  const dias = [];
  const hoje = new Date();

  hoje.setHours(hoje.getHours() - 3);
  hoje.setHours(12, 0, 0, 0);

  for (let i = 0; i < qtd; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    dias.push(`${ano}-${mes}-${dia}`);
  }

  return dias;
}

async function buscarDadosBaseAgenda({ slug, servicoId, profissionalId }) {
  const negocio = await agendaPublicaRepository.buscarNegocioPorSlug(slug);

  if (!negocio) {
    const erro = new Error("Negócio não encontrado.");
    erro.statusCode = 404;
    throw erro;
  }

  const servico = await agendaPublicaRepository.buscarServicoDoNegocio(
    servicoId,
    negocio.id
  );

  if (!servico) {
    const erro = new Error("Serviço não encontrado nesse negócio.");
    erro.statusCode = 404;
    throw erro;
  }

  const profissional =
    await agendaPublicaRepository.buscarProfissionalDoNegocio(
      profissionalId,
      negocio.id
    );

  if (!profissional) {
    const erro = new Error("Profissional não pertence a esse negócio.");
    erro.statusCode = 404;
    throw erro;
  }

  return {
    negocio,
    servico,
    profissional,
  };
}

module.exports = {
  gerarDiasProximos,
  buscarDadosBaseAgenda,
};