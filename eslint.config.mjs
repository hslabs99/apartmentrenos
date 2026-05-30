import eslintConfigNext from "eslint-config-next";

/** Next.js 16 ships a flat ESLint config; avoid FlatCompat + `extends` (circular JSON with eslint 9). */
const eslintConfig = [
  ...eslintConfigNext,
  {
    ignores: ["node_modules/**"],
  },
];

export default eslintConfig;
