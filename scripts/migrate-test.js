const {
  main,
} = require("./migrate");

main([
  "up",
  "--env",
  "test",
])
  .catch(
    (erro) => {
      console.error(
        "ERRO:",
        erro.message
      );

      process.exitCode = 1;
    }
  );
