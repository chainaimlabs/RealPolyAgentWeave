module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  overrides: [
    {
      files: ["hardhat.config.js"],
      globals: { task: true },
    },
  ],
  // Add global variables for Hardhat scripts
  globals: {
    ethers: "readonly",
    hre: "readonly",
  },
  rules: {
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: false,
        optionalDependencies: false,
        peerDependencies: false,
      },
    ],
    "prettier/prettier": [
      "error",
      {
        projectDependencies: false,
        devDependencies: ["test/*", "**/*.test.jsx"],
        endOfLine: "auto",
      },
    ],
    // Disable problematic rules for scripts
    "no-process-exit": "off",
    "no-undef": "off",
    "no-unused-vars": "warn",
    "no-case-declarations": "off",
  },
};
