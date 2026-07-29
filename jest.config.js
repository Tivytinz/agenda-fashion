module.exports = {
  testEnvironment: "node",
  setupFiles: [
    "<rootDir>/tests/setup-env.js"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/frontend/"
  ]
};
