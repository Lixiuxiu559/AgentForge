import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageQoder } from '../tools/package-qoder.mjs'

const source = fileURLToPath(new URL('..', import.meta.url))
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-qoder-test-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const file of ['.qoder-plugin', '.codex-plugin', '.claude-plugin', 'package.json', 'skills', 'LICENSE', 'docs/qoder.md']) {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await cp(join(source, file), join(root, file), { recursive: true })
  }
  return root
}

async function resources(root, prefix = '') {
  const files = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const file = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...await resources(root, file))
    else files.push(file)
  }
  return files.sort()
}

function unpack(archive, destination) {
  execFileSync('unzip', ['-q', archive, '-d', destination])
}

test('Qoder archive keeps all thirteen skills and runnable resources without changing shared source', async t => {
  const root = await fixture(t)
  const before = await readFile(join(root, 'skills/architecture-scout/SKILL.md'), 'utf8')
  const result = await packageQoder({ root, outDir: join(root, 'output with spaces') })
  assert.equal(result.skills, 13)
  const entries = execFileSync('unzip', ['-Z1', result.output], { encoding: 'utf8' }).trim().split('\n')
  const expected = (await resources(join(root, 'skills')))
    .filter(file => !file.endsWith('/agents/openai.yaml')).map(file => `skills/${file}`)
  assert.deepEqual(entries.sort(), [...expected, '.qoder-plugin/plugin.json', 'LICENSE', 'README.md'].sort())
  const installed = join(root, 'installed', 'agentforge')
  await mkdir(installed, { recursive: true })
  unpack(result.output, installed)
  const manifest = JSON.parse(await readFile(join(installed, '.qoder-plugin/plugin.json'), 'utf8'))
  assert.equal(manifest.name, 'agentforge')
  assert.equal(manifest.skills, './skills/')
  const scout = await readFile(join(installed, 'skills/architecture-scout/SKILL.md'), 'utf8')
  assert.match(scout, /^disable-model-invocation: true$/m)
  assert.match(scout, /^user-invocable: true$/m)
  assert.doesNotMatch(scout, /^dsh-model-invocable:/m)
  assert.equal(scout.slice(scout.indexOf('\n# ')), before.slice(before.indexOf('\n# ')))
  assert.equal(await readFile(join(root, 'skills/architecture-scout/SKILL.md'), 'utf8'), before)
  for (const file of expected.filter(file => !file.endsWith('/SKILL.md'))) {
    assert.deepEqual(await readFile(join(installed, file)), await readFile(join(root, file)), file)
  }
  for (const file of expected.filter(file => file.endsWith('/SKILL.md') && !file.includes('/architecture-scout/'))) {
    assert.equal(await readFile(join(installed, file), 'utf8'), await readFile(join(root, file), 'utf8'), file)
  }
  await mkdir(join(root, 'project/knowledge'), { recursive: true })
  await writeFile(join(root, 'project/knowledge/start.md'), '# Project knowledge\n')
  const run = spawnSync(process.execPath, [join(installed, 'skills/wiki/scripts/wiki.mjs'), 'check',
    '--root', join(root, 'project'), '--wiki', 'knowledge'], { cwd: tmpdir(), encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.equal(JSON.parse(run.stdout).status, 'passed')
  const xml = join(root, 'jacoco.xml')
  await writeFile(xml, '<report><package name="sample"><class name="sample/Example"><method name="run"><counter type="COMPLEXITY" missed="0" covered="2"/><counter type="LINE" missed="0" covered="3"/></method></class></package></report>')
  const audit = spawnSync(process.execPath, [join(installed, 'skills/complexity-audit/scripts/crap.cjs'), xml, '--lang', 'java'],
    { cwd: tmpdir(), encoding: 'utf8' })
  assert.equal(audit.status, 0, audit.stdout + audit.stderr)
  assert.match(audit.stdout, /sample\.Example#run/)
})

test('rebuilding replaces an old ZIP without retaining deleted resources or local cache files', async t => {
  const root = await fixture(t)
  const extra = join(root, 'skills/wiki/assets/old.txt')
  await writeFile(extra, 'temporary resource\n')
  await writeFile(join(root, 'skills/.DS_Store'), 'local metadata')
  const first = await packageQoder({ root })
  assert.match(execFileSync('unzip', ['-Z1', first.output], { encoding: 'utf8' }), /assets\/old.txt/)
  await rm(extra)
  const second = await packageQoder({ root })
  const listing = execFileSync('unzip', ['-Z1', second.output], { encoding: 'utf8' })
  assert.doesNotMatch(listing, /old\.txt|\.DS_Store/)
})

test('Qoder packaging rejects version drift, missing skills and missing package assets', async t => {
  const root = await fixture(t)
  const manifestPath = join(root, '.qoder-plugin/plugin.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: '99.0.0' }))
  await assert.rejects(packageQoder({ root }), /version differs/)
  await writeFile(manifestPath, JSON.stringify({ ...manifest, hooks: './hooks/hooks.json' }))
  await assert.rejects(packageQoder({ root }), /does not ship hooks/)
  await writeFile(manifestPath, JSON.stringify(manifest))
  const skill = join(root, 'skills/research/SKILL.md')
  const body = await readFile(skill, 'utf8')
  await rm(skill)
  await assert.rejects(packageQoder({ root }), /Expected thirteen skills/)
  await writeFile(skill, 'metadata missing\n')
  await assert.rejects(packageQoder({ root }), /Missing skill metadata/)
  await writeFile(skill, body)
  await rm(join(root, 'LICENSE'))
  await assert.rejects(packageQoder({ root }), /ENOENT/)
})

test('Qoder packaging rejects resource symlinks instead of bundling external files', async t => {
  const root = await fixture(t)
  await symlink(join(root, 'LICENSE'), join(root, 'skills/wiki/external.txt'))
  await assert.rejects(packageQoder({ root }), /regular file or directory/)
})

test('real doctor rejects Qoder version drift while other host versions still agree', async t => {
  const root = await fixture(t)
  for (const file of ['src', 'cordis.patch.yml', 'tools']) {
    await cp(join(source, file), join(root, file), { recursive: true })
  }
  const manifestPath = join(root, '.qoder-plugin/plugin.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: '99.0.0' }))
  const run = spawnSync(process.execPath, [join(root, 'tools/doctor.mjs')], { encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.match(run.stdout, /Qoder version differs/)
})
