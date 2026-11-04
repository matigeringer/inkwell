import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))

export function checkVersion(tag = process.env.CI_COMMIT_TAG) {
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
      { name: `inkwell-${version}-linux-x86_64.AppImage`, path: '/linux/inkwell.AppImage' },
      { name: `inkwell-${version}-linux-amd64.deb`, path: '/linux/inkwell.deb' }
    ],
    windows: [{ name: `inkwell-${version}-windows-x64.exe`, path: '/windows/inkwell.exe' }]
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

export async function releasePayload(directory, projectUrl, packageUrl) {
  const version = checkVersion()
  const links = []
  for (const [platform, entries] of Object.entries(artifacts(version))) {
    const name = `SHA256SUMS-${platform}.txt`
    const expected = await checksumManifest(platform, directory)
    if ((await readFile(join(directory, name), 'utf8')) !== expected) {
      throw new Error(`Checksum mismatch: ${name}`)
    }
    for (const entry of [...entries, { name, path: `/checksums/${name}` }]) {
      links.push({
        name: entry.name,
        url: `${packageUrl}/${entry.name}`,
        direct_asset_path: entry.path,
        link_type: 'package'
      })
    }
  }
  return {
    name: `Inkwell ${version}`,
    tag_name: `v${version}`,
    description: [
      `Inkwell ${version} para Linux y Windows de 64 bits (x86-64).`,
      '',
      'Linux: AppImage o paquete .deb. Windows: ejecutable portable, sin instalación.',
      'El ejecutable de Windows se distribuye sin firma digital.',
      '',
      `Consulta [instalación y requisitos](${projectUrl}/-/blob/v${version}/README.md)`,
      `y [notas de la versión](${projectUrl}/-/blob/v${version}/CHANGELOG.md).`,
      'Verifica las descargas con los archivos SHA256SUMS adjuntos.',
      '',
      'Software libre GPL-3.0-only. Código fuente disponible en los archivos de esta etiqueta.'
    ].join('\n'),
    assets: { links }
  }
}

async function publish(dryRun) {
  const version = checkVersion()
  if (!dryRun && process.env.CI_COMMIT_TAG !== `v${version}`) {
    throw new Error('Publishing requires a GitLab version tag pipeline')
  }
  const directory = join(root, 'dist')
  const projectUrl = process.env.CI_PROJECT_URL || metadata.homepage
  const api = process.env.CI_API_V4_URL || 'https://gitlab.com/api/v4'
  const project = encodeURIComponent(process.env.CI_PROJECT_ID || 'ada-arg/fountain')
  const endpoint = `${api}/projects/${project}`
  const packageUrl = `${endpoint}/packages/generic/inkwell/${version}`
  // Verify all three binaries and both manifests before making any request.
  const payload = await releasePayload(directory, projectUrl, packageUrl)
  if (dryRun) {
    await writeFile(join(directory, 'release.json'), JSON.stringify(payload, null, 2) + '\n')
    console.log('Release validated; preview saved in dist/release.json')
    return
  }
  const token = process.env.CI_JOB_TOKEN
  if (!token) throw new Error('CI_JOB_TOKEN is required')
  const headers = { 'JOB-TOKEN': token }
  const existing = await fetch(`${endpoint}/releases/v${version}`, {
    headers,
    signal: AbortSignal.timeout(30000)
  })
  // Released versions are immutable: do not overwrite downloadable binaries on retry.
  if (existing.ok) throw new Error(`v${version} already exists; publish a new version`)
  if (existing.status !== 404) throw new Error(`Release lookup failed: ${existing.status}`)
  for (const { name } of payload.assets.links) {
    const response = await fetch(`${packageUrl}/${name}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      body: createReadStream(join(directory, name)),
      duplex: 'half',
      signal: AbortSignal.timeout(600000)
    })
    if (!response.ok) throw new Error(`Upload failed for ${name}: ${response.status}`)
    console.log(`Uploaded ${name}`)
  }
  const response = await fetch(`${endpoint}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`Release creation failed: ${response.status}`)
  console.log(`Published ${projectUrl}/-/releases/v${version}`)
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
