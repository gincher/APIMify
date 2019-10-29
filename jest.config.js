// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  clearMocks: true,

  collectCoverage: true,

  coverageDirectory: "coverage",

  coveragePathIgnorePatterns: ["/node_modules/"],

  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.json"
    }
  },

  moduleFileExtensions: ["js", "ts", "tsx"],

  testEnvironment: "node",

  testMatch: ["**/tests/**/*.test.(ts|js)"],

  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },

  preset: "ts-jest"
};
