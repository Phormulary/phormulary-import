export default [
    {
      ignores: ["node_modules", "dist", "archive"],
    },
    {
      files: ["**/*.{ts,js}"],
      languageOptions: {
        parser: "@typescript-eslint/parser",
        parserOptions: {
          project: "./tsconfig.json",
        },
      },
      plugins: {
        prettier: require("eslint-plugin-prettier"),
        "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
      },
      rules: {
        "prettier/prettier": "error",
        "@typescript-eslint/no-unused-vars": "warn",
      },
    },
];
  