const adminRepository = require("../repositories/adminRepository");

async function listarNegociosAdmin() {
  const negocios = await adminRepository.listarNegocios();

  return {
    negocios,
  };
}

module.exports = {
  listarNegociosAdmin,
};