const path = require('node:path')

const tailwindcss = require(
  require.resolve('tailwindcss', {
    paths: [path.resolve(__dirname, '../../packages/components')],
  }),
)

module.exports = {
  plugins: [tailwindcss({ config: './tailwind.config.ts' }), require('autoprefixer')],
}
