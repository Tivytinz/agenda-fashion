const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",       // seu usuário do pgAdmin
    host: "localhost",
    database: "agendamento",      // nome do banco que você criou
    password: "123456",       // sua senha do postgres
    port: 5432
});

module.exports = {
    query: (text, params) => pool.query(text, params)
};