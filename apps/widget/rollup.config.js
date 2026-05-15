import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

export default {
  input: 'src/widget.ts',
  output: {
    file: 'dist/widget.js',
    format: 'iife',
    name: 'UniverReviews',
    sourcemap: false,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
    terser({
      compress: {
        drop_console: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
    }),
  ],
}
