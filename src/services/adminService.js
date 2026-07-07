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

module.exports = {
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin
};