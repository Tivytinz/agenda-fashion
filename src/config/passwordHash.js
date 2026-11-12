function obterBcryptRounds(env = process.env) {
  const rounds = Number(env.BCRYPT_ROUNDS);

  if (
    Number.isInteger(rounds) &&
    rounds >= 10 &&
    rounds <= 14
  ) {
    return rounds;
  }

  return 10;
}

module.exports = {
  obterBcryptRounds,
};
