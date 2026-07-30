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
      branches: 35,
      functions: 40,
      lines: 50,
      statements: 50
    }
  }
};
