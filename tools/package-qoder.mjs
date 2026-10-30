#!/usr/bin/env node
// Build a Qoder-only archive from the shared skills without modifying sources.
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '..')

export async function qoderManifest(root) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, '.qoder-plugin/plugin.json'), 'utf8'))
  if (manifest.name !== 'agentforge' || !/^\d+\.\d+\.\d+$/.test(manifest.version) || manifest.skills !== './skills/') {
    throw new Error('Qoder manifest requires agentforge, a release version and ./skills/')
  }
  for (const component of ['agents', 'commands', 'rules', 'hooks', 'mcpServers']) {
    if (component in manifest) throw new Error(`Qoder package does not ship ${component}`)
  }
  for (const file of ['package.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const other = JSON.parse(await fs.readFile(path.join(root, file), 'utf8'))
    if (other.version !== manifest.version) throw new Error(`Qoder version differs from ${file}`)
  }
  return manifest
}

export function qoderSkill(text, name) {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---)(?=\r?\n|$)/.exec(text)
  if (!match || !/^name:\s*\S+/m.test(match[2]) || !/^description:\s*\S+/m.test(match[2])) {
    throw new Error(`Missing skill metadata: ${name}`)
  }
  const metadata = match[2].split(/\r?\n/).filter(line => !/^dsh-model-invocable:/.test(line))
  if (name === 'architecture-scout') {
    const filtered = metadata.filter(line => !/^(disable-model-invocation|user-invocable):/.test(line))
    filtered.push('disable-model-invocation: true', 'user-invocable: true')
    return `---\n${filtered.join('\n')}\n---${text.slice(match[0].length)}`
  }
  return `---\n${metadata.join('\n')}\n---${text.slice(match[0].length)}`
}

async function copyResources(source, destination, prefix = '') {
  const files = []
  for (const entry of (await fs.readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === '__pycache__' || entry.name === 'node_modules') continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (relative.endsWith('/agents/openai.yaml')) continue
    if (/[\r\n\\]/.test(relative)) throw new Error(`Unsupported resource path: ${relative}`)
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      await fs.mkdir(to, { recursive: true })
      files.push(...await copyResources(from, to, relative))
    } else if (entry.isFile()) {
      if (/^[^/]+\/SKILL\.md$/.test(relative)) {
        await fs.writeFile(to, qoderSkill(await fs.readFile(from, 'utf8'), relative.split('/')[0]))
      } else {
        await fs.copyFile(from, to)
      }
      files.push(`skills/${relative}`)
    } else {
      throw new Error(`Resource must be a regular file or directory: ${relative}`)
    }
  }
  return files
}

export async function packageQoder({ root = ROOT, outDir = path.join(root, 'dist/qoder') } = {}) {
  root = path.resolve(root)
  outDir = path.resolve(outDir)
  const manifest = await qoderManifest(root)
  const work = await fs.mkdtemp(path.join(tmpdir(), 'agentforge-qoder-'))
  try {
    const stage = path.join(work, 'agentforge')
    await fs.mkdir(path.join(stage, '.qoder-plugin'), { recursive: true })
    await fs.mkdir(path.join(stage, 'skills'))
    await fs.writeFile(path.join(stage, '.qoder-plugin/plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    const files = await copyResources(path.join(root, 'skills'), path.join(stage, 'skills'))
    const skills = files.filter(file => /^skills\/[^/]+\/SKILL\.md$/.test(file))
    if (skills.length !== 13 || !skills.includes('skills/architecture-scout/SKILL.md')) {
      throw new Error(`Expected thirteen skills including architecture-scout, found ${skills.length}`)
    }
    await fs.copyFile(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'))
    await fs.copyFile(path.join(root, 'docs/qoder.md'), path.join(stage, 'README.md'))
    files.push('.qoder-plugin/plugin.json', 'LICENSE', 'README.md')
    const archive = path.join(work, `agentforge-${manifest.version}.zip`)
    // zip -@ reads a sorted file list; a fresh archive prevents stale entries.
    execFileSync('zip', ['-q', '-X', archive, '-@'], { cwd: stage, input: `${files.sort().join('\n')}\n`, encoding: 'utf8' })
    await fs.mkdir(outDir, { recursive: true })
    const output = path.join(outDir, path.basename(archive))
    await fs.copyFile(archive, output)
    return { output, version: manifest.version, skills: skills.length, files: files.length }
  } finally {
    await fs.rm(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 2) throw new Error('Usage: node tools/package-qoder.mjs (requires zip on PATH)')
    const result = await packageQoder()
    console.log(`Qoder: ${result.skills} skills, ${result.files} files → ${result.output}`)
  } catch (error) {
    console.error(`Qoder package failed: ${error.message}`)
    process.exitCode = 1
  }
}
