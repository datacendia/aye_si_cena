/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  // Named explicitly so that __tests__/helpers/ can hold shared fixtures without
  // Jest picking each one up as an empty suite and failing the run.
  testMatch: ["<rootDir>/__tests__/**/*.test.ts?(x)"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx", esModuleInterop: true } }] },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  collectCoverageFrom: ["lib/**/*.ts", "!lib/auth.ts", "!lib/session.ts"]
};
