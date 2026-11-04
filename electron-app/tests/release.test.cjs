const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

test('release filenames agree with electron-builder architecture names', async () => {
  const yaml = require('js-yaml')
  const { Arch, getArtifactArchName } = require('builder-util')
  const { artifacts } = await import('../scripts/release.mjs')
  const metadata = require('../package.json')
  const config = yaml.load(
    await fs.readFile(path.join(__dirname, '../electron-builder.yml'), 'utf8')
  )
  const expected = [
    ...artifacts().linux.map((entry) => entry.name),
    ...artifacts().windows.map((entry) => entry.name)
  ]
  const actual = [
    [config.appImage.artifactName, 'AppImage'],
    [config.deb.artifactName, 'deb'],
    [config.portable.artifactName, 'exe']
  ].map(([pattern, ext]) =>
    pattern.replace(/\$\{(name|version|arch|ext)\}/g, (_match, key) => {
      return { ...metadata, arch: getArtifactArchName(Arch.x64, ext), ext }[key]
    })
  )
  assert.deepEqual(actual, expected)
})

test('release tags match the package version', async () => {
  const { checkVersion } = await import('../scripts/release.mjs')
  const { version } = require('../package.json')
  assert.equal(checkVersion(`v${version}`), version)
  assert.throws(() => checkVersion('v9999.0.0'), /must match/)
  assert.throws(() => checkVersion(version), /must match/)
  assert.throws(() => checkVersion(`v${version}-rc.1`), /must match/)
})

test('release requires all artifacts and rejects modified binaries before upload', async (t) => {
  const { artifacts, prepare, releasePayload } = await import('../scripts/release.mjs')
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'inkwell-release-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const project = 'https://gitlab.example/owner/project'
  const registry = 'https://gitlab.example/api/v4/projects/1/packages/generic/inkwell/1.0.0'
  await assert.rejects(prepare('mac', directory), /Platform/)
  await assert.rejects(releasePayload(directory, project, registry), /ENOENT/)
  for (const [platform, entries] of Object.entries(artifacts())) {
    for (const { name } of entries) await fs.writeFile(path.join(directory, name), `test ${name}`)
    await prepare(platform, directory)
  }
  const payload = await releasePayload(directory, project, registry)
  assert.equal(payload.assets.links.length, 5)
  assert.deepEqual(
    payload.assets.links.map((link) => link.direct_asset_path),
    [
      '/linux/inkwell.AppImage',
      '/linux/inkwell.deb',
      '/checksums/SHA256SUMS-linux.txt',
      '/windows/inkwell.exe',
      '/checksums/SHA256SUMS-windows.txt'
    ]
  )
  assert.ok(payload.assets.links.every((link) => link.url.startsWith(registry + '/')))
  const binary = path.join(directory, artifacts().windows[0].name)
  await fs.appendFile(binary, 'tampered')
  await assert.rejects(releasePayload(directory, project, registry), /Checksum mismatch/)
  await fs.writeFile(binary, '')
  await assert.rejects(prepare('windows', directory), /Empty artifact/)
})
