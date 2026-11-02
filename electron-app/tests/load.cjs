const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
module.exports = function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath)
  const result = esbuild.buildSync({
    entryPoints: [filename],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    jsx: 'automatic',
    logLevel: 'silent',
    alias: {
      'tiptap-markdown': path.join(root, 'node_modules/tiptap-markdown/dist/tiptap-markdown.es.js')
    },
    external: ['*?asset'],
    define: { 'import.meta.url': JSON.stringify(require('node:url').pathToFileURL(filename).href) }
  })
  const module = new Module(filename)
  module.filename = filename
  module.paths = Module._nodeModulePaths(path.dirname(filename))
  const original = module.require.bind(module)
  module.require = (id) =>
    id in mocks ? mocks[id] : id.endsWith('?asset') ? 'icon.png' : original(id)
  module._compile(result.outputFiles[0].text, filename)
  return module.exports
}
