module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/lambda'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
    '**/__tests__/**/*.ts',
    '**/*.(test|spec).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: './tsconfig.json'
    }]
  },
  collectCoverageFrom: [
    'lambda/**/*.ts',
    'lib/**/*.ts',
    '!lambda/**/*.d.ts',
    '!lib/**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/cdk.out/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/lib/$1',
    '^@lambda/(.*)$': '<rootDir>/lambda/$1',
    '^@frontend/(.*)$': '<rootDir>/frontend/$1'
  },
  testTimeout: 30000,
  maxWorkers: 4,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true
};