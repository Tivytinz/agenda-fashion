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
      branches: 55,
      functions: 70,
      lines: 70,
      statements: 70
    },
    "./src/services/checkoutService.js": {
      branches: 60,
      functions: 85,
      lines: 75,
      statements: 75
    },
    "./src/services/assinaturaWebhookService.js": {
      branches: 80,
      functions: 95,
      lines: 80,
      statements: 80
    },
    "./src/repositories/webhookEventoRepository.js": {
      branches: 70,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
