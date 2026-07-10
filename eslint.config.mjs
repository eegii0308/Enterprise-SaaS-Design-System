import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    // Vite prototype build output (bundled/minified, not source).
    ignores: ["dist/**"],
  },
];

export default eslintConfig;
