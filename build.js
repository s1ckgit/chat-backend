const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['./index.ts'],
  bundle: true,
  platform: 'node',
  outfile: './dist/index.js',
  minify: true,
  packages: 'external',
})
  .then(() => {
    console.log('Build completed successfully!')
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
