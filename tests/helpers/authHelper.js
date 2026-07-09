const request = require("supertest");
const app = require("../../src/server");
const random = require("./random");

async function criarCliente() {

    const email = random.email();
    const whatsapp = random.whatsapp();

    await request(app)
        .post("/cadastro")
        .send({
            nome: "Cliente Teste",
            email,
            senha: "123456",
            whatsapp,
            tipo: "cliente"
        });

    const login = await request(app)
        .post("/login")
        .send({
            email,
            senha: "123456"
        });

    return {
        token: login.body.token,
        usuario: login.body.usuario
    };
}

module.exports = {
    criarCliente
};