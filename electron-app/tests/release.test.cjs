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
  const project = 'https://github.com/owner/project'
  await assert.rejects(prepare('mac', directory), /Platform/)
  await assert.rejects(releasePayload(directory, project), /ENOENT/)
  for (const [platform, entries] of Object.entries(artifacts())) {
    for (const { name } of entries) await fs.writeFile(path.join(directory, name), `test ${name}`)
    await prepare(platform, directory)
  }
  const payload = await releasePayload(directory, project)
  assert.equal(payload.assets.length, 5)
  assert.deepEqual(
    payload.assets.map((asset) => asset.name),
    [
      'inkwell-linux-x86_64.AppImage',
      'inkwell-linux-amd64.deb',
      'SHA256SUMS-linux.txt',
      'inkwell-windows-x64.exe',
      'SHA256SUMS-windows.txt'
    ]
  )
  assert.ok(payload.body.includes(`${project}/blob/v${payload.tag_name.slice(1)}/README.md`))
  const manifest = payload.assets.find((asset) => asset.name === 'SHA256SUMS-windows.txt')
  const executable = payload.assets.find((asset) => asset.name === 'inkwell-windows-x64.exe')
  assert.equal(manifest.content, `${executable.sha256}  ${executable.name}\n`)
  const binary = path.join(directory, artifacts().windows[0].name)
  await fs.appendFile(binary, 'tampered')
  await assert.rejects(releasePayload(directory, project), /Checksum mismatch/)
  await fs.writeFile(binary, '')
  await assert.rejects(prepare('windows', directory), /Empty artifact/)
})

test('GitHub release stays a draft until every upload succeeds', async (t) => {
  const { artifacts, prepare, publish } = await import('../scripts/release.mjs')
  const { version } = require('../package.json')
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'inkwell-github-release-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  for (const [platform, entries] of Object.entries(artifacts())) {
    for (const { name } of entries) await fs.writeFile(path.join(directory, name), `test ${name}`)
    await prepare(platform, directory)
  }
  const env = {
    GITHUB_REF_TYPE: 'tag',
    GITHUB_REF_NAME: `v${version}`,
    GITHUB_REPOSITORY: 'owner/project',
    GITHUB_TOKEN: 'test-token'
  }
  const calls = []
  let failUpload = false
  const request = async (url, options) => {
    const method = options.method || 'GET'
    calls.push({ url, method })
    if (method === 'GET') return new Response('{}', { status: 404 })
    if (url.endsWith('/releases')) {
      assert.equal(JSON.parse(options.body).draft, true)
      return Response.json({
        id: 42,
        upload_url: 'https://uploads.github.com/repos/owner/project/releases/42/assets{?name,label}'
      })
    }
    if (method === 'POST') {
      const chunks = []
      if (typeof options.body === 'string') chunks.push(Buffer.from(options.body))
      else for await (const chunk of options.body) chunks.push(chunk)
      assert.equal(Buffer.concat(chunks).length, Number(options.headers['Content-Length']))
      return new Response('{}', { status: failUpload ? 500 : 201 })
    }
    assert.equal(method, 'PATCH')
    assert.equal(JSON.parse(options.body).draft, false)
    return Response.json({})
  }
  await publish(false, { directory, env, request })
  assert.deepEqual(
    calls.map((call) => call.method),
    ['GET', 'POST', 'POST', 'POST', 'POST', 'POST', 'POST', 'PATCH']
  )
  calls.length = 0
  failUpload = true
  await assert.rejects(publish(false, { directory, env, request }), /Upload failed/)
  assert.ok(!calls.some((call) => call.method === 'PATCH'))
  calls.length = 0
  await assert.rejects(publish(false, { directory, env: {}, request }), /version tag workflow/)
  assert.equal(calls.length, 0)
})
