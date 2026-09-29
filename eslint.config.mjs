import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['next-env.d.ts', '.next/**', 'node_modules/**', 'arl-keuangan-v7.html', 'public/sw.js'] },
];

export default eslintConfig;
