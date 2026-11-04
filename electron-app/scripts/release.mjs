import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))

export function checkVersion(
  tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined
) {
  const version = metadata.version
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Only stable X.Y.Z versions are supported')
  }
  if (lock.version !== version || lock.packages[''].version !== version) {
    throw new Error('package.json and package-lock.json versions must match')
  }
  if (tag && tag !== `v${version}`) {
    throw new Error(`Tag ${tag} must match package version v${version}`)
  }
  return version
}

export function artifacts(version = checkVersion()) {
  return {
    linux: [
      {
        name: `inkwell-${version}-linux-x86_64.AppImage`,
        downloadName: 'inkwell-linux-x86_64.AppImage'
      },
      { name: `inkwell-${version}-linux-amd64.deb`, downloadName: 'inkwell-linux-amd64.deb' }
    ],
    windows: [
      { name: `inkwell-${version}-windows-x64.exe`, downloadName: 'inkwell-windows-x64.exe' }
    ]
  }
}

async function checksum(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function checksumManifest(platform, directory) {
  const selected = artifacts()[platform]
  if (!selected) throw new Error('Platform must be linux or windows')
  const lines = []
  for (const { name } of selected) {
    const file = join(directory, name)
    if (!(await stat(file)).size) throw new Error(`Empty artifact: ${name}`)
    lines.push(`${await checksum(file)}  ${name}\n`)
  }
  return lines.join('')
}

export async function prepare(platform, directory = join(root, 'dist')) {
  const manifest = await checksumManifest(platform, directory)
  await writeFile(join(directory, `SHA256SUMS-${platform}.txt`), manifest)
}

export async function releasePayload(directory, projectUrl) {
  const version = checkVersion()
  const assets = []
  for (const [platform, entries] of Object.entries(artifacts(version))) {
    const name = `SHA256SUMS-${platform}.txt`
    const expected = await checksumManifest(platform, directory)
    if ((await readFile(join(directory, name), 'utf8')) !== expected) {
      throw new Error(`Checksum mismatch: ${name}`)
    }
    const lines = expected.trimEnd().split('\n')
    const manifest = []
    for (const [index, entry] of entries.entries()) {
      const sha256 = lines[index].split('  ')[0]
      assets.push({
        name: entry.downloadName,
        source: entry.name,
        sha256
      })
      manifest.push(`${sha256}  ${entry.downloadName}\n`)
    }
    // Release downloads have stable names, so regenerate their checksum manifests.
    assets.push({ name, content: manifest.join('') })
  }
  return {
    name: `Inkwell ${version}`,
    tag_name: `v${version}`,
    body: [
      `Inkwell ${version} para Linux y Windows de 64 bits (x86-64).`,
      '',
      'Linux: AppImage o paquete .deb. Windows: ejecutable portable, sin instalación.',
      'El ejecutable de Windows se distribuye sin firma digital.',
      '',
      `Consulta [instalación y requisitos](${projectUrl}/blob/v${version}/README.md)`,
      `y [notas de la versión](${projectUrl}/blob/v${version}/CHANGELOG.md).`,
      'Verifica las descargas con los archivos SHA256SUMS adjuntos.',
      '',
      'Software libre GPL-3.0-only. Código fuente disponible en los archivos de esta etiqueta.'
    ].join('\n'),
    assets
  }
}

export async function publish(
  dryRun,
  { directory = join(root, 'dist'), env = process.env, request = fetch } = {}
) {
  const version = checkVersion(env.GITHUB_REF_TYPE === 'tag' ? env.GITHUB_REF_NAME : undefined)
  if (!dryRun && (env.GITHUB_REF_TYPE !== 'tag' || env.GITHUB_REF_NAME !== `v${version}`)) {
    throw new Error('Publishing requires a GitHub version tag workflow')
  }
  const repository = env.GITHUB_REPOSITORY || new URL(metadata.homepage).pathname.slice(1)
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository')
  const projectUrl = `https://github.com/${repository}`
  const endpoint = `https://api.github.com/repos/${repository}`
  // Verify all three binaries and both manifests before making any request.
  const payload = await releasePayload(directory, projectUrl)
  if (dryRun) {
    await writeFile(join(directory, 'release.json'), JSON.stringify(payload, null, 2) + '\n')
    console.log('Release validated; preview saved in dist/release.json')
    return
  }
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is required')
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  const existing = await request(`${endpoint}/releases/tags/v${version}`, {
    headers,
    signal: AbortSignal.timeout(30000)
  })
  // Released versions are immutable: do not overwrite downloadable binaries on retry.
  if (existing.ok) throw new Error(`v${version} already exists; publish a new version`)
  if (existing.status !== 404) throw new Error(`Release lookup failed: ${existing.status}`)
  const { assets, ...release } = payload
  // Keep incomplete uploads private; publish only after all five assets are attached.
  const created = await request(`${endpoint}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...release, draft: true, prerelease: false }),
    signal: AbortSignal.timeout(30000)
  })
  if (!created.ok) throw new Error(`Release creation failed: ${created.status}`)
  const draft = await created.json()
  const uploadUrl = draft.upload_url.replace(/\{.*$/, '')
  if (new URL(uploadUrl).origin !== 'https://uploads.github.com') {
    throw new Error('Unexpected GitHub upload URL')
  }
  for (const { name, source, content } of assets) {
    const response = await request(`${uploadUrl}?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': source ? 'application/octet-stream' : 'text/plain; charset=utf-8',
        'Content-Length': String(
          source ? (await stat(join(directory, source))).size : Buffer.byteLength(content)
        )
      },
      body: source ? createReadStream(join(directory, source)) : content,
      ...(source ? { duplex: 'half' } : {}),
      signal: AbortSignal.timeout(600000)
    })
    if (!response.ok) throw new Error(`Upload failed for ${name}: ${response.status}`)
    console.log(`Uploaded ${name}`)
  }
  const response = await request(`${endpoint}/releases/${draft.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft: false, make_latest: 'true' }),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`Release publication failed: ${response.status}`)
  console.log(`Published ${projectUrl}/releases/tag/v${version}`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    switch (process.argv[2]) {
      case 'check':
        console.log(`Release version: ${checkVersion()}`)
        break
      case 'prepare':
        await prepare(process.argv[3])
        break
      case 'publish':
        await publish(process.argv.includes('--dry-run'))
        break
      default:
        throw new Error('Usage: release.mjs check | prepare linux|windows | publish [--dry-run]')
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
