import { lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createSnapshot, digest, matches } from './snapshot.mjs'

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const only = (value, keys) => Object.keys(value).every(key => keys.includes(key))
const nonempty = value => typeof value === 'string' && Boolean(value.trim())
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const decisions = ['updated', 'no-change', 'blocked']
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value

export function freshnessConfig(root, value, local, modules, configPath) {
  if (value === undefined) return undefined
  if (!object(value) || !only(value, ['records', 'ignore']) || !nonempty(value.records)) throw new Error('Invalid freshness configuration')
  const normalize = path => relative(root, local(root, path)).split(sep).join('/') || '.'
  const records = normalize(value.records)
  if (records.split('/').some(part => part.toLowerCase() === '.git')) throw new Error('Review records cannot be stored in Git metadata')
  if (!records.endsWith('.json') || records === configPath || modules.some(mod => mod.docs.includes(records) || mod.sources.includes(records))) throw new Error('Freshness records must be a separate JSON ledger, not a config, document, or explicit source')
  const ignore = value.ignore ?? []
  if (!Array.isArray(ignore)) throw new Error('freshness.ignore must be an array')
  const seen = new Set()
  const normalized = ignore.map(entry => {
    if (!object(entry) || !only(entry, ['path', 'reason']) || !nonempty(entry.path) || /[*?\[\]]/.test(entry.path) || !nonempty(entry.reason)) throw new Error('Ignore entries require literal paths and a reason')
    const path = normalize(entry.path)
    if (seen.has(path)) throw new Error('Duplicate freshness ignore path')
    seen.add(path)
    return { path, reason: entry.reason.trim() }
  })
  return { records, ignore: normalized }
}

function parseLedger(text, root, local) {
  const value = JSON.parse(text)
  if (!object(value) || !only(value, ['version', 'modules']) || value.version !== 1 || !object(value.modules)) throw new Error('Invalid freshness review ledger')
  const path = input => {
    if (!nonempty(input)) throw new Error('Invalid review snapshot path')
    const normalized = relative(root, local(root, input)).split(sep).join('/')
    if (normalized !== input || normalized === '') throw new Error('Noncanonical review snapshot path')
  }
  const snapshot = values => {
    if (!object(values) || !Object.keys(values).length) throw new Error('Invalid or empty review snapshot')
    for (const [name, entry] of Object.entries(values)) {
      path(name)
      if (!object(entry) || !only(entry, ['sha256', 'mode']) || !hash(entry.sha256) || !['100644', '100755'].includes(entry.mode)) throw new Error('Invalid review fingerprint')
    }
  }
  for (const [id, entry] of Object.entries(value.modules)) {
    if (!nonempty(id) || !object(entry) || !only(entry, ['reviewedAt', 'reviewer', 'decision', 'reason', 'evidence', 'configDigest', 'sourceSnapshot', 'docSnapshot']) || !nonempty(entry.reviewer) || !nonempty(entry.reason) || !decisions.includes(entry.decision) || !hash(entry.configDigest)) throw new Error('Invalid module review record')
    if (typeof entry.reviewedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(entry.reviewedAt) || Number.isNaN(Date.parse(entry.reviewedAt)) || new Date(entry.reviewedAt).toISOString() !== entry.reviewedAt) throw new Error('Invalid review timestamp')
    if (!Array.isArray(entry.evidence) || !entry.evidence.length || new Set(entry.evidence).size !== entry.evidence.length) throw new Error('Review evidence is required')
    entry.evidence.forEach(path)
    snapshot(entry.sourceSnapshot)
    snapshot(entry.docSnapshot)
    if (entry.evidence.some(path => !Object.hasOwn(entry.sourceSnapshot, path) && !Object.hasOwn(entry.docSnapshot, path))) throw new Error('Review evidence is outside its recorded snapshots')
  }
  return value
}

async function inventory(snapshot, module, records) {
  const sourceSnapshot = Object.create(null), docSnapshot = Object.create(null), missing = []
  const add = async (path, target) => {
    if (path === records) return false
    const entry = await snapshot.read(path)
    if (!entry) return false
    target[path] = { sha256: digest(entry.content), mode: entry.mode }
    return true
  }
  for (const source of module.sources) {
    let found = false
    for (const path of snapshot.paths) if (matches(path, source)) found = await add(path, sourceSnapshot) || found
    if (!found) missing.push(source)
  }
  for (const path of module.docs) if (!await add(path, docSnapshot)) missing.push(path)
  return { sourceSnapshot, docSnapshot, missing: [...new Set(missing)] }
}
function differences(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter(path => before[path]?.sha256 !== after[path]?.sha256 || before[path]?.mode !== after[path]?.mode)
}

async function ensureLedgerParent(root, target, local) {
  const parent = dirname(target)
  const rel = relative(root, parent)
  let current = root
  for (const part of rel.split(sep).filter(Boolean)) {
    current = resolve(current, part)
    try {
      const entry = await lstat(current)
      if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('Review ledger parent must be a real project directory')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await mkdir(current)
    }
  }
  const actualParent = await realpath(parent)
  if (actualParent !== root) local(root, relative(root, actualParent))
  try { if ((await lstat(target)).isSymbolicLink()) throw new Error('Review ledger must not be a symbolic link') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

async function writeReview(root, records, moduleId, review, local) {
  const target = local(root, records)
  await ensureLedgerParent(root, target, local)
  // An exclusive per-ledger lock prevents independent module reviews losing updates.
  const lockPath = `${target}.lock`
  const lock = await open(lockPath, 'wx')
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    let ledger = { version: 1, modules: {} }
    try { ledger = parseLedger(await readFile(target, 'utf8'), root, local) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    ledger.modules = { ...ledger.modules, [moduleId]: review }
    await open(temporary, 'wx').then(async file => { try { await file.writeFile(`${JSON.stringify(ledger, null, 2)}\n`) } finally { await file.close() } })
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true })
    await lock.close()
    await rm(lockPath, { force: true })
  }
}

/** Return mechanical freshness only. Review decisions are explicit agent/user attestations. */
export async function runFreshness({ root, options, parseConfig, local, git, revision, parseChanges, coverage, issue, limited }) {
  if (!options.config) throw new Error('--config is required for freshness, review, and gate')
  let scope = options.command === 'freshness' ? 'worktree' : options.scope ?? (options.command === 'review' ? 'worktree' : undefined)
  if (!['worktree', 'staged', 'range'].includes(scope) || (options.command !== 'gate' && scope === 'range')) throw new Error('Invalid freshness candidate scope')
  let head, baseline
  if (scope === 'range') {
    if (!options.base) throw new Error('range requires --base')
    head = revision(root, options.head || 'HEAD')
    baseline = git(root, ['merge-base', revision(root, options.base), head]).trim()
  } else if (options.base || options.head) throw new Error('--base/--head only apply to range')
  const candidate = await createSnapshot({ root, scope, head, git })
  const configPath = relative(root, local(root, options.config)).split(sep).join('/')
  const configFile = await candidate.read(configPath)
  if (!configFile) throw new Error('Configuration is absent from the selected candidate snapshot')
  const rawConfig = configFile.content.toString('utf8')
  const profile = parseConfig(root, rawConfig, configPath)
  const configDigest = digest(JSON.stringify(canonical(JSON.parse(rawConfig))))
  let modules = profile.modules
  if (options.module !== undefined) {
    modules = modules.filter(module => module.id === options.module)
    if (!modules.length) throw new Error('Unknown module ID')
  }
  coverage.freshness = { scope, ...(head ? { head } : {}), modules: modules.length, review: 'self-attested' }
  if (!profile.freshness) {
    if (options.command === 'review') throw new Error('Configure freshness.records before recording a review')
    limited('Freshness is not configured')
    return { modules: modules.map(module => ({ id: module.id, state: 'unknown', reason: 'Freshness is not configured', changedSources: [], changedDocs: [] })) }
  }
  const records = profile.freshness.records
  const ledgerFile = await candidate.read(records)
  const ledger = ledgerFile ? parseLedger(ledgerFile.content.toString('utf8'), root, local) : { version: 1, modules: {} }
  if (!modules.length) limited('No modules have freshness coverage')
  if (options.command === 'review') {
    if (!options.module || !decisions.includes(options.decision) || !nonempty(options.reason) || !nonempty(options.reviewer)) throw new Error('Review requires module, decision, reason, and reviewer')
    const module = modules[0]
    const current = await inventory(candidate, module, records)
    if (!module.sources.length || !module.docs.length || current.missing.length) throw new Error('Cannot review absent or empty source/document coverage')
    const evidence = JSON.parse(options.evidence ?? 'null')
    if (!Array.isArray(evidence) || !evidence.length || new Set(evidence).size !== evidence.length || evidence.some(path => !nonempty(path) || (!Object.hasOwn(current.sourceSnapshot, path) && !Object.hasOwn(current.docSnapshot, path)))) throw new Error('Evidence must identify existing paths covered by this module snapshot')
    const review = { reviewedAt: new Date().toISOString(), reviewer: options.reviewer.trim(), decision: options.decision, reason: options.reason.trim(), evidence, configDigest, sourceSnapshot: current.sourceSnapshot, docSnapshot: current.docSnapshot }
    if (!candidate.paths.includes(records)) {
      try {
        git(root, ['check-ignore', '-q', '--no-index', '--', records])
        throw new Error('Review ledger must not be ignored by Git')
      } catch (error) { if (error.status !== 1) throw error }
    }
    await writeReview(root, records, module.id, review, local)
    coverage.freshness.modules = 1
    if (review.decision === 'blocked') issue('wiki-review-blocked', module.id, review.reason)
    return { records, written: true, modules: [{ id: module.id, state: review.decision === 'blocked' ? 'blocked' : 'fresh', reason: review.reason, reviewedAt: review.reviewedAt, changedSources: [], changedDocs: [] }], ...(scope === 'staged' ? { next: 'Stage the written review ledger before running the staged gate' } : {}) }
  }
  const results = []
  for (const module of modules) {
    const current = await inventory(candidate, module, records)
    const previous = Object.hasOwn(ledger.modules, module.id) ? ledger.modules[module.id] : undefined
    const changedSources = previous ? differences(previous.sourceSnapshot, current.sourceSnapshot) : []
    const changedDocs = previous ? differences(previous.docSnapshot, current.docSnapshot) : []
    let state, reason
    if (!previous) { state = 'unknown'; reason = 'No review record for this module' }
    else if (previous.decision === 'blocked') { state = 'blocked'; reason = previous.reason }
    else if (previous.configDigest !== configDigest || changedSources.length || changedDocs.length || current.missing.length) { state = 'stale'; reason = previous.configDigest !== configDigest ? 'Configuration changed since review' : 'Sources or documents changed since review' }
    else if (!module.sources.length || !module.docs.length) { state = 'unknown'; reason = 'Source or document coverage is empty' }
    else { state = 'fresh'; reason = previous.reason }
    if (state === 'unknown') limited(`Unknown freshness: ${module.id}`)
    if (state === 'stale' || state === 'blocked') issue(`wiki-${state}`, module.id, reason)
    results.push({ id: module.id, state, reason, changedSources, changedDocs, ...(current.missing.length ? { missing: current.missing } : {}), ...(previous ? { reviewedAt: previous.reviewedAt, decision: previous.decision } : {}) })
  }
  coverage.freshness.modules = results.length
  if (options.command !== 'gate') return { records, modules: results }
  const parameters = scope === 'range' ? [baseline, head] : scope === 'staged' ? ['--cached'] : []
  const changes = parseChanges(git(root, ['diff', '--name-status', '-z', '--find-renames', ...parameters, '--']))
  if (scope === 'worktree') for (const path of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) changes.push({ status: '?', path })
  const ignored = [], unmapped = []
  for (const change of changes) {
    change.modules = profile.modules.filter(module => module.sources.some(source => matches(change.path, source) || (change.oldPath && matches(change.oldPath, source))) || module.docs.includes(change.path) || module.docs.includes(change.oldPath)).map(module => module.id)
    const paths = [change.path, change.oldPath].filter(Boolean)
    const exclusions = []
    for (const path of paths) {
      if (profile.modules.some(module => module.sources.some(source => matches(path, source)) || module.docs.includes(path))) continue
      const exclusion = path === records ? { path, reason: 'Review ledger is excluded from its own fingerprints' } : profile.freshness.ignore.find(entry => matches(path, entry.path))
      if (exclusion) exclusions.push(exclusion)
      else if (!unmapped.includes(path)) unmapped.push(path)
    }
    if (exclusions.length) ignored.push({ ...change, reasons: exclusions.map(entry => entry.reason) })
  }
  if (unmapped.length) limited('Changed paths without a module mapping or explicit ignore remain unresolved')
  return { records, modules: results, changes, unmapped, ignored, ...(head ? { head, baseline } : { baseline: scope === 'staged' ? 'HEAD or empty tree' : 'index' }) }
}
