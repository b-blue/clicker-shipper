module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/game/scenes/**',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 65,
      lines: 65,
      statements: 65,
    },
  },
};
