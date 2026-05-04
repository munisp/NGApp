import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default [
  // Browser-friendly UMD build
  {
    input: 'src/index.ts',
    output: {
      name: 'PaymentSwitch',
      file: 'dist/payment-switch.js',
      format: 'umd',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },
  // ES module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/payment-switch.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },
  // React components build
  {
    input: 'src/react.tsx',
    external: ['react', 'react-dom'],
    output: {
      file: 'dist/react.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },
];
