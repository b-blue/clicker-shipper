module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/game/scenes/**',
    '!src/game/ui/ItemManual.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
};
