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

module.exports = {
  listarNegociosAdmin,
  listarAgendamentosAdmin,
};