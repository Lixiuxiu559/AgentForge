import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skill = fileURLToPath(new URL('../skills/wiki/', import.meta.url))
const script = join(skill, 'scripts/wiki.mjs')
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_PARAMETERS|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/.test(key)) delete env[key]

async function fixture(t, initialize = true) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-wiki-mapping-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  if (initialize) git(root, 'init', '-q')
  return root
}

function git(root, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Mapping Test',
    '-c', 'user.email=mapping-test@example.invalid', '-c', 'commit.gpgsign=false', '-C', root, ...args],
  { encoding: 'utf8', env }).trim()
}

async function put(root, path, text) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), text)
}

async function configure(root, modules, extra = {}) {
  await put(root, 'wiki.config.json', JSON.stringify({ version: 1, modules, ...extra }, null, 2) + '\n')
}

function run(root, entrypoint = script) {
  const result = spawnSync(process.execPath, [entrypoint, 'mapping', '--root', root, '--config', 'wiki.config.json'], {
    cwd: tmpdir(), encoding: 'utf8', env,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null, result.stderr)
  const body = JSON.parse(result.stdout)
  assert.equal(result.status, body.status === 'passed' ? 0 : body.status === 'error' ? 2 : 1, result.stdout)
  assert.ok(Array.isArray(body.findings))
  assert.equal(body.coverage.semantic, 'not_run')
  if (body.status !== 'error') {
    assert.equal(body.coverage.mapping.scope, 'git-visible-worktree')
    assert.equal(body.coverage.mapping.assessment, 'path-coverage-only')
  }
  return body
}

test('business knowledge maps across code layers and reports shared sources without failing', async t => {
  const root = await fixture(t)
  const secretMarker = 'MAPPING-MUST-NOT-OUTPUT-SOURCE-CONTENTS'
  await put(root, 'api/ranked.js', secretMarker)
  await put(root, 'web/ranked.jsx', 'ranked UI\n')
  await put(root, 'api/casual.js', 'casual API\n')
  await put(root, 'shared/rotation.js', 'shared rotation\n')
  await put(root, 'wiki/ranked.md', '# Ranked\n')
  await put(root, 'wiki/casual.md', '# Casual\n')
  await put(root, 'LICENSE.txt', 'A file outside this knowledge scope.\n')
  await configure(root, [
    { id: 'ranked', sources: ['api/ranked.js', 'web/ranked.jsx', 'shared'], docs: ['wiki/ranked.md'] },
    { id: 'casual', sources: ['api/casual.js', 'shared'], docs: ['wiki/casual.md'] },
  ])
  const originalConfig = await readFile(join(root, 'wiki.config.json'), 'utf8')
  const result = run(root)
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.modules[0].sourceFiles, ['api/ranked.js', 'shared/rotation.js', 'web/ranked.jsx'])
  assert.deepEqual(result.overlaps, [{
    modules: ['ranked', 'casual'], sharedFiles: ['shared/rotation.js'],
    shareOfSources: [1 / 3, 1 / 2], identicalSourceSets: false,
  }])
  assert.ok(result.unmappedPaths.includes('LICENSE.txt'))
  assert.ok(!JSON.stringify(result).includes(secretMarker))
  assert.equal(await readFile(join(root, 'api/ranked.js'), 'utf8'), secretMarker)
  assert.equal(await readFile(join(root, 'wiki.config.json'), 'utf8'), originalConfig)
})

test('identical source sets are explicit information rather than semantic approval or automatic error', async t => {
  const root = await fixture(t)
  await put(root, 'api/rotation/one.js', 'one\n')
  await put(root, 'api/rotation/two.js', 'two\n')
  await put(root, 'wiki/a.md', '# A\n')
  await put(root, 'wiki/b.md', '# B\n')
  await configure(root, [
    { id: 'a', sources: ['api/rotation'], docs: ['wiki/a.md'] },
    { id: 'b', sources: ['api/rotation'], docs: ['wiki/b.md'] },
  ])
  const result = run(root)
  assert.equal(result.status, 'passed')
  assert.equal(result.overlaps[0].identicalSourceSets, true)
  assert.deepEqual(result.overlaps[0].shareOfSources, [1, 1])
  assert.equal(result.overlaps[0].sharedFiles.length, 2)
  assert.equal(result.coverage.semantic, 'not_run')
})

test('path boundaries, Unicode and newline names work, and tracked deletions are not counted as sources', async t => {
  const root = await fixture(t)
  const name = 'src/order/中文 空格\nsource.js'
  await put(root, name, 'original content\n')
  await put(root, 'src/orders2/other.js', 'unrelated path\n')
  await put(root, 'wiki/order.md', '# Order\n')
  await configure(root, [{ id: 'order', sources: ['src/order'], docs: ['wiki/order.md'] }])
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Track fixture')
  const original = run(root)
  assert.equal(original.status, 'passed')
  assert.deepEqual(original.modules[0].sourceFiles, [name])
  assert.ok(original.unmappedPaths.includes('src/orders2/other.js'))
  await put(root, name, 'entirely different contents; mapping still measures paths\n')
  assert.deepEqual(run(root), original)
  await rm(join(root, name))
  const deleted = run(root)
  assert.equal(deleted.status, 'issues')
  assert.deepEqual(deleted.modules[0].sourceFiles, [])
  assert.deepEqual(deleted.modules[0].unmatchedSources, ['src/order'])
})

test('missing, empty, and unavailable mapping coverage cannot pass', async t => {
  const root = await fixture(t)
  await configure(root, [])
  assert.equal(run(root).status, 'partial')
  await put(root, 'wiki/core.md', '# Core\n')
  await configure(root, [{ id: 'core', sources: [], docs: ['wiki/core.md'] }])
  assert.equal(run(root).status, 'partial')
  await configure(root, [{ id: 'core', sources: ['missing'], docs: ['wiki/missing.md'] }])
  const missing = run(root)
  assert.equal(missing.status, 'issues')
  assert.deepEqual(missing.modules[0].missingDocuments, ['wiki/missing.md'])
  const nonRepository = await fixture(t, false)
  await configure(nonRepository, [{ id: 'core', sources: ['src'], docs: ['wiki/core.md'] }])
  assert.equal(run(nonRepository).status, 'error')
})

test('Git ignores and ledger exclusions do not hide already mapped sources', async t => {
  const root = await fixture(t)
  await put(root, '.gitignore', 'src/generated/\n')
  await put(root, 'src/main.js', 'main\n')
  await put(root, 'src/generated/hidden.js', 'ignored\n')
  await put(root, 'wiki/core.md', '# Core\n')
  await put(root, 'wiki/reviews.json', '{}\n')
  await put(root, 'legal-note.txt', 'Explicitly outside knowledge scope.\n')
  await configure(root, [{ id: 'core', sources: ['src'], docs: ['wiki/core.md'] }], {
    freshness: { records: 'wiki/reviews.json', ignore: [
      { path: 'src', reason: 'Must not suppress configured sources.' },
      { path: 'legal-note.txt', reason: 'A legal note outside module knowledge.' },
    ] },
  })
  const result = run(root)
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.modules[0].sourceFiles, ['src/main.js'])
  assert.ok(!result.unmappedPaths.includes('src/generated/hidden.js'))
  assert.ok(!result.unmappedPaths.includes('wiki/reviews.json'))
  assert.ok(!result.unmappedPaths.includes('legal-note.txt'))
  assert.deepEqual(result.excludedPaths.map(item => item.path).sort(), ['legal-note.txt', 'wiki/reviews.json'])
})

test('symbolic links remain unsupported and never expose outside source contents', async t => {
  const root = await fixture(t)
  const outside = await fixture(t, false)
  await put(root, 'src/main.js', 'main\n')
  await put(root, 'wiki/core.md', '# Core\n')
  const marker = 'OUTSIDE-MAPPING-SOURCE-MARKER'
  await put(outside, 'private.txt', marker)
  await symlink(join(outside, 'private.txt'), join(root, 'src/link.js'))
  await configure(root, [{ id: 'core', sources: ['src'], docs: ['wiki/core.md'] }])
  const result = run(root)
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.modules[0].sourceFiles, ['src/main.js'])
  assert.deepEqual(result.unsupportedPaths, ['src/link.js'])
  assert.ok(!JSON.stringify(result).includes(marker))
  assert.equal(await readFile(join(outside, 'private.txt'), 'utf8'), marker)
})

test('relocated package assesses an explicitly selected project from an unrelated cwd', async t => {
  const root = await fixture(t)
  const installation = await fixture(t, false)
  await put(root, 'src/main.js', 'main\n')
  await put(root, 'wiki/core.md', '# Core\n')
  await configure(root, [{ id: 'core', sources: ['src'], docs: ['wiki/core.md'] }])
  await cp(join(skill, 'scripts'), join(installation, 'scripts'), { recursive: true })
  await cp(join(skill, 'assets'), join(installation, 'assets'), { recursive: true })
  assert.deepEqual(run(root, join(installation, 'scripts/wiki.mjs')), run(root))
})
