// compat.extends crashes against eslint-plugin-react 7.37.5's self-referencing
// flat config; using eslint-config-next's native subpath exports instead.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**'] },
];

export default eslintConfig;
