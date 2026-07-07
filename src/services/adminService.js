const adminRepository = require("../repositories/adminRepository");

async function listarNegociosAdmin() {
  const negocios = await adminRepository.listarNegocios();

  return {
    negocios,
  };
}

async function listarAgendamentosAdmin() {
  const agendamentos =
    await adminRepository.listarAgendamentosRecentes();

  return { agendamentos };
}

async function buscarMarketingAdmin() {
  const [
    negociosMaisAgendados,
    negociosMaisVistos,
    cidades,
    usuariosRecentes,
  ] = await Promise.all([
    adminRepository.listarNegociosMaisAgendados(),
    adminRepository.listarNegociosMaisVistos(),
    adminRepository.listarCidadesTop(),
    adminRepository.listarUsuariosRecentes(),
  ]);

  return {
    negociosMaisAgendados,
    negociosMaisVistos,
    cidades,
    usuariosRecentes,
  };
}

async function buscarDashboardAdmin({ periodo = "all" }) {
  const [gerais, hoje, marketing, qualidade] = await Promise.all([
    adminRepository.buscarIndicadoresGerais(periodo),
    adminRepository.buscarIndicadoresHoje(),
    adminRepository.buscarIndicadoresMarketing(periodo),
    adminRepository.buscarIndicadoresQualidade(),
  ]);

  const taxaConversaoGeral =
    gerais.totalNegocios > 0
      ? Math.round((gerais.totalAgendamentos / gerais.totalNegocios) * 100)
      : 0;

  return {
    periodo,
    ...gerais,
    ...hoje,
    taxaConversaoGeral,
    ...marketing,
    cliquesWhatsapp: 0,
    cliquesMaps: 0,
    ...qualidade,
  };
}

module.exports = {
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin,
  buscarDashboardAdmin,
};