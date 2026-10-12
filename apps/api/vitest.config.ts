import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC: esbuild `emitDecoratorMetadata` ni bilmaydi, NestJS DI testlarda ishlamaydi
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
  },
});
