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
    }
  }
};
