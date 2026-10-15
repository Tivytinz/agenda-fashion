// Serve a aplicação Express real da branch contra PostgreSQL de teste.
const app = require("../src/server");
const port = Number(process.env.PORT || 4173);
app.listen(port, "127.0.0.1", () => console.log(`Performance QA Express: ${port}`));
