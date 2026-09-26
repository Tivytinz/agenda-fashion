module.exports = {
  testEnvironment: "node",
  setupFiles: [
    "<rootDir>/tests/setup-env.js"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/frontend/"
  ],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/docs/**",
    "!src/server.js"
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 75,
      lines: 75,
      statements: 75
    },
    "./src/repositories/checkoutRepository.js": {
      branches: 70,
      functions: 90,
      lines: 90,
      statements: 90
    },
    "./src/repositories/assinaturaRepository.js": {
      branches: 55,
      functions: 90,
      lines: 90,
      statements: 90
    },
    "./src/repositories/pagamentoRepository.js": {
      branches: 75,
      functions: 90,
      lines: 90,
      statements: 90
    },
    "./src/services/checkoutService.js": {
      branches: 60,
      functions: 85,
      lines: 75,
      statements: 75
    },
    "./src/repositories/webhookEventoRepository.js": {
      branches: 65,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
