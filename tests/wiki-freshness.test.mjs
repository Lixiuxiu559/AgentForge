import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmod, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skill = fileURLToPath(new URL('../skills/wiki/', import.meta.url))
const script = join(skill, 'scripts/wiki.mjs')
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_PARAMETERS|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/.test(key)) delete env[key]

function git(root, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Wiki Freshness Test',
    '-c', 'user.email=wiki-freshness@example.invalid', '-c', 'commit.gpgsign=false', '-C', root, ...args],
  { encoding: 'utf8', env }).trim()
}

async function put(root, path, text) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), text)
}

async function directory(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-wiki-freshness-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function fixture(t, { auxiliary = false, freshness = true } = {}) {
  const root = await directory(t)
  git(root, 'init', '-q')
  await put(root, 'src/main.js', 'export const limit = 3\n')
  await put(root, 'contracts/rules.md', '# Contract\n\nThe limit is three.\n')
  await put(root, 'wiki/core.md', '# Core\n\nThe approved limit is three.\n')
  const config = {
    version: 1,
    modules: [{ id: 'core', sources: ['src', 'contracts', 'wiki.config.json'], docs: ['wiki/core.md'] }],
    ...(freshness ? { freshness: { records: 'wiki/reviews.json' } } : {}),
  }
  if (auxiliary) {
    await put(root, 'aux/main.js', 'export const enabled = true\n')
    await put(root, 'wiki/aux.md', '# Auxiliary\n\nEnabled by default.\n')
    config.modules.push({ id: 'aux', sources: ['aux'], docs: ['wiki/aux.md'] })
  }
  await saveConfig(root, config)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Initial fixture')
  return { root, config }
}

async function saveConfig(root, config) {
  await put(root, 'wiki.config.json', JSON.stringify(config, null, 2) + '\n')
}

function run(root, command, args = [], options = {}) {
  const result = spawnSync(process.execPath, [options.script ?? script, command, '--root', root,
    '--config', 'wiki.config.json', ...args], { cwd: tmpdir(), encoding: 'utf8', env: options.env ?? env })
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null, result.stderr)
  let body
  try { body = JSON.parse(result.stdout) } catch {
    assert.fail(`Expected JSON, exit ${result.status}: ${result.stdout}\n${result.stderr}`)
  }
  assert.ok(['passed', 'issues', 'partial', 'error'].includes(body.status), result.stdout)
  assert.equal(result.status, body.status === 'passed' ? 0 : body.status === 'error' ? 2 : 1, result.stdout)
  assert.ok(Array.isArray(body.findings))
  assert.equal(body.coverage.semantic, 'not_run')
  return body
}

function state(body, id = 'core') {
  assert.ok(Array.isArray(body.modules), JSON.stringify(body))
  const module = body.modules.find(item => (item.id ?? item.module ?? item.name) === id)
  assert.ok(module, JSON.stringify(body))
  return module.state
}

function review(root, { module = 'core', decision = 'updated', reason = 'Reviewed source and contract against module knowledge.', evidence, scope } = {}) {
  const paths = evidence ?? (module === 'core' ? ['src/main.js', 'contracts/rules.md', 'wiki/core.md'] : ['aux/main.js', 'wiki/aux.md'])
  return run(root, 'review', ['--module', module, '--decision', decision, '--reason', reason,
    '--reviewer', 'fixture-reviewer', '--evidence', JSON.stringify(paths), ...(scope ? ['--scope', scope] : [])])
}

test('a module moves from unknown to reviewed, stale, and explicitly reviewed without document changes', async t => {
  const { root } = await fixture(t)
  const initial = run(root, 'freshness')
  assert.equal(initial.status, 'partial')
  assert.equal(state(initial), 'unknown')
  await assert.rejects(readFile(join(root, 'wiki/reviews.json')), { code: 'ENOENT' })
  assert.notEqual(review(root).status, 'error')
  assert.equal(run(root, 'freshness').status, 'passed')
  const document = await readFile(join(root, 'wiki/core.md'), 'utf8')
  await put(root, 'src/main.js', 'export const limit = 3 // clarify the implementation\n')
  const stale = run(root, 'freshness')
  assert.equal(stale.status, 'issues')
  assert.equal(state(stale), 'stale')
  assert.notEqual(review(root, { decision: 'no-change', reason: 'The edit adds a comment; the approved limit and documented behavior remain three.' }).status, 'error')
  assert.equal(run(root, 'freshness').status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/core.md'), 'utf8'), document)
})

test('document or contract changes invalidate reviews while unrelated commits and old dates do not', async t => {
  const { root } = await fixture(t)
  review(root)
  const records = JSON.parse(await readFile(join(root, 'wiki/reviews.json'), 'utf8'))
  records.modules.core.reviewedAt = '2000-01-01T00:00:00.000Z'
  await put(root, 'wiki/reviews.json', JSON.stringify(records))
  await put(root, 'unrelated.txt', 'Not in the module knowledge scope.\n')
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Unrelated commit and unchanged reviewed contents')
  assert.equal(run(root, 'freshness').status, 'passed')
  await put(root, 'wiki/core.md', '# Core\n\nA human adds a useful explanation.\n')
  assert.equal(state(run(root, 'freshness')), 'stale')
  review(root)
  await put(root, 'contracts/rules.md', '# Contract\n\nThe limit requires a new product decision.\n')
  assert.equal(state(run(root, 'freshness')), 'stale')
})

test('blocked review decisions remain blocked even when all file contents match', async t => {
  const { root } = await fixture(t)
  assert.notEqual(review(root, { decision: 'blocked', reason: 'The implementation and the approved contract need a product decision.' }).status, 'error')
  const reading = run(root, 'freshness')
  assert.equal(reading.status, 'issues')
  assert.equal(state(reading), 'blocked')
  assert.equal(run(root, 'gate', ['--scope', 'worktree']).status, 'issues')
})

test('new, deleted, and renamed paths invalidate the complete source file inventory', async t => {
  const { root } = await fixture(t)
  review(root)
  const source = 'src/新 文件\nname.js'
  await put(root, source, 'export const extra = true\n')
  assert.equal(state(run(root, 'freshness')), 'stale')
  review(root)
  await rename(join(root, source), join(root, 'src/重命名.js'))
  assert.equal(state(run(root, 'freshness')), 'stale')
  review(root)
  await rm(join(root, 'src/重命名.js'))
  assert.equal(state(run(root, 'freshness')), 'stale')
})

test('executable mode changes are part of the reviewed source snapshot', { skip: process.platform === 'win32' }, async t => {
  const { root } = await fixture(t)
  review(root)
  await chmod(join(root, 'src/main.js'), 0o755)
  assert.equal(state(run(root, 'freshness')), 'stale')
})

test('mapping changes invalidate existing module attestations and review preserves other modules', async t => {
  const { root, config } = await fixture(t, { auxiliary: true })
  review(root)
  review(root, { module: 'aux' })
  assert.equal(run(root, 'freshness').status, 'passed')
  const ledgerPath = join(root, 'wiki/reviews.json')
  const auxiliary = JSON.parse(await readFile(ledgerPath, 'utf8')).modules.aux
  await put(root, 'src/main.js', 'export const limit = 3 // reviewed comment\n')
  review(root, { decision: 'no-change', reason: 'Only an implementation comment changed.' })
  assert.deepEqual(JSON.parse(await readFile(ledgerPath, 'utf8')).modules.aux, auxiliary)
  await put(root, 'extra/source.js', 'export const added = true\n')
  config.modules[0].sources.push('extra')
  await saveConfig(root, config)
  const changed = run(root, 'freshness')
  assert.equal(state(changed), 'stale')
  assert.equal(state(changed, 'aux'), 'stale')
})

test('unmapped changes require explicit justified exclusions and mapped sources cannot escape hashing', async t => {
  const { root, config } = await fixture(t)
  review(root)
  await put(root, 'license-note.txt', 'Legal wording outside module knowledge.\n')
  assert.equal(run(root, 'gate', ['--scope', 'worktree']).status, 'partial')
  config.freshness.ignore = [{ path: 'license-note.txt', reason: 'This legal note has no runtime or module knowledge impact.' }]
  await saveConfig(root, config)
  review(root)
  assert.equal(run(root, 'gate', ['--scope', 'worktree']).status, 'passed')
  config.freshness.ignore.push({ path: 'src', reason: 'Even an exclusion must not hide mapped source changes.' })
  await saveConfig(root, config)
  review(root)
  await put(root, 'src/main.js', 'export const limit = 4\n')
  assert.equal(run(root, 'gate', ['--scope', 'worktree']).status, 'issues')
})

test('staged gates use index source, config, and records rather than the restored worktree', async t => {
  const { root } = await fixture(t)
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed baseline')
  const original = await readFile(join(root, 'src/main.js'), 'utf8')
  await put(root, 'src/main.js', 'export const limit = 4\n')
  git(root, 'add', 'src/main.js')
  await put(root, 'src/main.js', original)
  review(root, { decision: 'no-change', reason: 'The restored worktree still has the old behavior.' })
  assert.equal(run(root, 'freshness').status, 'passed')
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'issues')
  assert.notEqual(review(root, { scope: 'staged', reason: 'Reviewed the candidate index contents and documented the observed change.' }).status, 'error')
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'issues')
  git(root, 'add', 'wiki/reviews.json')
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'passed')
  await put(root, 'wiki.config.json', '{ broken worktree config')
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'passed')
})

test('worktree gates do not pass when staged content diverges from the worktree', async t => {
  const { root } = await fixture(t)
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed baseline')
  await put(root, 'src/new.js', 'export const hidden = true\n')
  git(root, 'add', 'src/new.js')
  await rm(join(root, 'src/new.js'))
  const added = run(root, 'gate', ['--scope', 'worktree'])
  assert.equal(added.status, 'partial')
  assert.deepEqual(added.divergent, ['src/new.js'])
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'issues')
  git(root, 'reset', '-q', '--', 'src/new.js')
  const original = await readFile(join(root, 'src/main.js'), 'utf8')
  await put(root, 'src/main.js', 'export const limit = 4\n')
  git(root, 'add', 'src/main.js')
  await put(root, 'src/main.js', original)
  const restored = run(root, 'gate', ['--scope', 'worktree'])
  assert.equal(restored.status, 'partial')
  assert.deepEqual(restored.divergent, ['src/main.js'])
  await put(root, 'src/main.js', 'export const limit = 4\n')
  review(root)
  git(root, 'add', '.')
  const aligned = run(root, 'gate', ['--scope', 'worktree'])
  assert.equal(aligned.status, 'passed')
  assert.deepEqual(aligned.divergent, [])
})

test('range gates read the selected commit tree and cannot borrow uncommitted fresh records', async t => {
  const { root } = await fixture(t)
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed baseline')
  const base = git(root, 'rev-parse', 'HEAD')
  await put(root, 'src/main.js', 'export const limit = 4\n')
  git(root, 'add', 'src/main.js')
  git(root, 'commit', '-qm', 'Changed source without review')
  const staleHead = git(root, 'rev-parse', 'HEAD')
  review(root)
  assert.equal(run(root, 'freshness').status, 'passed')
  assert.equal(run(root, 'gate', ['--scope', 'range', '--base', base, '--head', staleHead]).status, 'issues')
  git(root, 'add', 'wiki/reviews.json')
  git(root, 'commit', '-qm', 'Record source review')
  const freshHead = git(root, 'rev-parse', 'HEAD')
  assert.equal(run(root, 'gate', ['--scope', 'range', '--base', base, '--head', freshHead]).status, 'passed')
  await put(root, 'wiki.config.json', '{ broken worktree config')
  await put(root, 'wiki/reviews.json', '{ broken worktree ledger')
  assert.equal(run(root, 'gate', ['--scope', 'range', '--base', base, '--head', freshHead]).status, 'passed')
})

test('checks stay read-only and a relocated installation uses the selected project', async t => {
  const { root } = await fixture(t)
  review(root)
  const before = await readFile(join(root, 'wiki/reviews.json'), 'utf8')
  const install = await directory(t)
  await cp(join(skill, 'scripts'), join(install, 'scripts'), { recursive: true })
  await cp(join(skill, 'assets'), join(install, 'assets'), { recursive: true })
  assert.equal(run(root, 'freshness', [], { script: join(install, 'scripts/wiki.mjs') }).status, 'passed')
  assert.equal(run(root, 'gate', ['--scope', 'worktree']).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/reviews.json'), 'utf8'), before)
})

test('missing coverage, unknown modules, malformed records, and invalid review arguments fail closed', async t => {
  const { root, config } = await fixture(t, { freshness: false })
  assert.notEqual(run(root, 'freshness').status, 'passed')
  config.freshness = { records: 'wiki/reviews.json' }
  await saveConfig(root, config)
  assert.equal(run(root, 'freshness', ['--module', 'missing']).status, 'error')
  assert.equal(run(root, 'freshness', ['--module', 'core', '--module', 'core']).status, 'error')
  const valid = ['--module', 'core', '--decision', 'no-change', '--reason', 'Reviewed contract.', '--reviewer', 'fixture', '--evidence', '["src/main.js"]']
  assert.equal(run(root, 'review', valid.map(value => value === 'Reviewed contract.' ? '' : value)).status, 'error')
  assert.equal(run(root, 'review', valid.map(value => value === '["src/main.js"]' ? '[]' : value)).status, 'error')
  await put(root, 'unrelated.txt', 'Not part of the reviewed module.\n')
  assert.equal(run(root, 'review', valid.map(value => value === '["src/main.js"]' ? '["unrelated.txt"]' : value)).status, 'error')
  await put(root, 'wiki/reviews.json', '{ invalid')
  assert.equal(run(root, 'freshness').status, 'error')
  await put(root, 'wiki/reviews.json', JSON.stringify({ version: 1, modules: { core: { reason: 'Not a complete attestation.' } } }))
  assert.equal(run(root, 'freshness').status, 'error')
})

test('review refuses record paths that would overwrite project data, config, or another JSON document', async t => {
  const { root, config } = await fixture(t)
  const original = await readFile(join(root, 'src/main.js'), 'utf8')
  config.freshness.records = 'src/main.js'
  await saveConfig(root, config)
  assert.equal(review(root).status, 'error')
  assert.equal(await readFile(join(root, 'src/main.js'), 'utf8'), original)
  config.freshness.records = 'wiki.config.json'
  await saveConfig(root, config)
  const configured = await readFile(join(root, 'wiki.config.json'), 'utf8')
  assert.equal(review(root).status, 'error')
  assert.equal(await readFile(join(root, 'wiki.config.json'), 'utf8'), configured)
  config.freshness.records = 'data.json'
  await saveConfig(root, config)
  await put(root, 'data.json', '{"ownedByProject":true}\n')
  assert.equal(review(root).status, 'error')
  assert.equal(await readFile(join(root, 'data.json'), 'utf8'), '{"ownedByProject":true}\n')
  config.freshness.records = '../outside.json'
  await saveConfig(root, config)
  assert.equal(review(root).status, 'error')
  config.freshness.records = '.git/reviews.json'
  await saveConfig(root, config)
  assert.equal(review(root).status, 'error')
  await assert.rejects(readFile(join(root, '.git/reviews.json')), { code: 'ENOENT' })
})

test('source and record symlinks cannot reveal or modify files outside the project', async t => {
  const { root } = await fixture(t)
  review(root)
  const outside = await directory(t)
  await put(outside, 'private.md', 'PRIVATE-FRESHNESS-MARKER\n')
  await symlink(join(outside, 'private.md'), join(root, 'src/escape.md'))
  const sourceResult = run(root, 'freshness')
  assert.notEqual(sourceResult.status, 'passed')
  assert.ok(!JSON.stringify(sourceResult).includes('PRIVATE-FRESHNESS-MARKER'))
  await rm(join(root, 'src/escape.md'))
  await rm(join(root, 'wiki/reviews.json'))
  await symlink(join(outside, 'private.md'), join(root, 'wiki/reviews.json'))
  const recordResult = review(root)
  assert.equal(recordResult.status, 'error')
  assert.equal(await readFile(join(outside, 'private.md'), 'utf8'), 'PRIVATE-FRESHNESS-MARKER\n')
})

test('explicit project roots ignore inherited repository and index redirects', async t => {
  const { root } = await fixture(t)
  const { root: foreign } = await fixture(t)
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed baseline')
  const result = run(root, 'gate', ['--scope', 'staged'], { env: {
    ...env, GIT_DIR: join(foreign, '.git'), GIT_WORK_TREE: root,
    GIT_INDEX_FILE: join(foreign, '.git/index'),
  } })
  assert.equal(result.status, 'passed')
})

test('missing documents and empty source coverage cannot be accepted as reviewed knowledge', async t => {
  const { root, config } = await fixture(t)
  review(root)
  await rm(join(root, 'wiki/core.md'))
  assert.equal(run(root, 'freshness').status, 'issues')
  assert.equal(review(root).status, 'error')
  await put(root, 'wiki/core.md', '# Core\n\nRestored document.\n')
  config.modules[0].sources = []
  await saveConfig(root, config)
  assert.notEqual(run(root, 'freshness').status, 'passed')
  assert.equal(review(root).status, 'error')
  config.modules[0].sources = ['src']
  config.freshness.ignore = [{ path: 'unmapped.txt', reason: '' }]
  await saveConfig(root, config)
  assert.equal(run(root, 'freshness').status, 'error')
})

test('range gates use the merge-base and exclude changes made only on the base branch', async t => {
  const { root } = await fixture(t)
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed baseline')
  const ancestor = git(root, 'rev-parse', 'HEAD')
  git(root, 'checkout', '-qb', 'freshness-feature')
  await put(root, 'src/main.js', 'export const limit = 3 // source explanation\n')
  review(root, { decision: 'no-change', reason: 'Only a source comment changed; reviewed behavior is unchanged.' })
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed feature')
  const feature = git(root, 'rev-parse', 'HEAD')
  git(root, 'checkout', '-qb', 'freshness-base', ancestor)
  await put(root, 'base-only-unmapped.txt', 'This change is not part of the feature.\n')
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Independent base branch change')
  assert.equal(run(root, 'gate', ['--scope', 'range', '--base', 'freshness-base', '--head', feature]).status, 'passed')
})

test('an unmerged index cannot be used as a candidate freshness snapshot', async t => {
  const { root } = await fixture(t)
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed baseline')
  const original = git(root, 'branch', '--show-current')
  git(root, 'checkout', '-qb', 'conflict-left')
  await put(root, 'src/main.js', 'export const limit = 4\n')
  git(root, 'add', 'src/main.js')
  git(root, 'commit', '-qm', 'Left edit')
  git(root, 'checkout', '-q', original)
  await put(root, 'src/main.js', 'export const limit = 5\n')
  git(root, 'add', 'src/main.js')
  git(root, 'commit', '-qm', 'Right edit')
  assert.throws(() => git(root, 'merge', '--no-commit', '--no-ff', 'conflict-left'))
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'error')
})

test('whole-project reviews support root ledgers and hash special object-key file names', async t => {
  const { root, config } = await fixture(t)
  config.modules[0].sources = ['.']
  config.freshness.records = 'reviews.json'
  await saveConfig(root, config)
  await put(root, '__proto__', 'Original source content.\n')
  assert.notEqual(review(root).status, 'error')
  assert.equal(run(root, 'freshness').status, 'passed')
  const ledger = JSON.parse(await readFile(join(root, 'reviews.json'), 'utf8'))
  assert.ok(Object.hasOwn(ledger.modules.core.sourceSnapshot, '__proto__'))
  await put(root, '__proto__', 'Changed source content.\n')
  assert.equal(state(run(root, 'freshness')), 'stale')
})

test('a mapped rename origin cannot hide an unmapped destination at the staged gate', async t => {
  const { root, config } = await fixture(t)
  await put(root, 'src/kept.js', 'export const remainsInModule = true\n')
  review(root)
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Reviewed source inventory')
  await mkdir(join(root, 'relocated'))
  git(root, 'mv', 'src/main.js', 'relocated/main.js')
  review(root, { scope: 'staged', decision: 'no-change',
    reason: 'Reviewed remaining module files; the moved implementation still needs its destination mapped.',
    evidence: ['src/kept.js', 'wiki/core.md'] })
  git(root, 'add', 'wiki/reviews.json')
  const unmapped = run(root, 'gate', ['--scope', 'staged'])
  assert.equal(unmapped.status, 'partial')
  assert.ok(unmapped.unmapped.includes('relocated/main.js'))
  config.modules[0].sources.push('relocated')
  await saveConfig(root, config)
  git(root, 'add', 'wiki.config.json')
  review(root, { scope: 'staged', decision: 'no-change',
    reason: 'Reviewed both rename paths and the mapping; the documented behavior remains unchanged.',
    evidence: ['relocated/main.js', 'src/kept.js', 'wiki/core.md'] })
  git(root, 'add', 'wiki/reviews.json')
  assert.equal(run(root, 'gate', ['--scope', 'staged']).status, 'passed')
})

test('ledger evidence outside the recorded union and empty fingerprint sets are rejected', async t => {
  const { root } = await fixture(t)
  review(root)
  const path = join(root, 'wiki/reviews.json')
  const original = await readFile(path, 'utf8')
  for (const mutate of [
    record => { record.evidence = ['not-covered.txt'] },
    record => { record.sourceSnapshot = {} },
    record => { record.docSnapshot = {} },
  ]) {
    const ledger = JSON.parse(original)
    mutate(ledger.modules.core)
    await writeFile(path, JSON.stringify(ledger))
    assert.equal(run(root, 'freshness').status, 'error')
  }
})

test('a newly ignored ledger is refused rather than written outside candidate visibility', async t => {
  const { root } = await fixture(t)
  await put(root, '.gitignore', 'wiki/reviews.json\n')
  assert.equal(review(root).status, 'error')
  await assert.rejects(readFile(join(root, 'wiki/reviews.json')), { code: 'ENOENT' })
})

test('fingerprint property order does not invalidate an otherwise identical review', async t => {
  const { root } = await fixture(t)
  review(root)
  const path = join(root, 'wiki/reviews.json')
  const ledger = JSON.parse(await readFile(path, 'utf8'))
  for (const field of ['sourceSnapshot', 'docSnapshot']) {
    ledger.modules.core[field] = Object.fromEntries(Object.entries(ledger.modules.core[field])
      .map(([name, fingerprint]) => [name, { mode: fingerprint.mode, sha256: fingerprint.sha256 }]))
  }
  await writeFile(path, JSON.stringify(ledger))
  assert.equal(run(root, 'freshness').status, 'passed')
  await put(root, 'src/main.js', 'export const limit = 4\n')
  assert.equal(state(run(root, 'freshness')), 'stale')
})
