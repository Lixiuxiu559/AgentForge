import { lstat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { matches } from './snapshot.mjs'

// Inspect path coverage only. No source contents, model calls, or project writes.
export async function inspectMapping({ root, profile, git, coverage, issue, limited }) {
  coverage.mapping = { scope: 'git-visible-worktree', modules: profile.modules.length, assessment: 'path-coverage-only' }
  if (!profile.modules.length) {
    limited('No modules configured for mapping assessment')
    return { modules: [], overlaps: [], unmappedPaths: [], excludedPaths: [], unsupportedPaths: [] }
  }
  if (resolve(git(root, ['rev-parse', '--show-toplevel']).trim()) !== root) throw new Error('--root must be the Git repository root')
  const paths = [...new Set(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort()
  const files = [], unsupportedPaths = []
  for (const path of paths) {
    let current = root, present = true
    const parts = path.split('/')
    try {
      for (let i = 0; i < parts.length; i++) {
        current = resolve(current, parts[i])
        const rel = relative(root, current)
        if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('Mapping path escapes project')
        const entry = await lstat(current)
        if (entry.isSymbolicLink() || (i === parts.length - 1 && !entry.isFile())) {
          unsupportedPaths.push(path)
          present = false
          break
        }
      }
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
      present = false
    }
    if (present) files.push(path)
  }
  if (unsupportedPaths.length) limited('Symbolic links or non-file Git entries are outside mapping assessment coverage')
  const records = profile.freshness?.records
  const candidates = files.filter(path => path !== records)
  const modules = profile.modules.map(module => {
    const sourceFiles = candidates.filter(path => module.sources.some(source => matches(path, source)))
    const documents = module.docs.filter(path => candidates.includes(path))
    const unmatchedSources = module.sources.filter(source => !sourceFiles.some(path => matches(path, source)))
    const missingDocuments = module.docs.filter(path => !documents.includes(path))
    if (!module.sources.length || !module.docs.length) limited(`Module lacks source or document coverage: ${module.id}`)
    for (const path of unmatchedSources) issue('unmatched-mapping-source', path, `${module.id}: no Git-visible regular source files`)
    for (const path of missingDocuments) issue('missing-mapping-document', path, `${module.id}: document is absent from Git-visible regular files`)
    return { id: module.id, sourceFiles, documents, unmatchedSources, missingDocuments }
  })
  const overlaps = []
  for (let i = 0; i < modules.length; i++) for (let j = i + 1; j < modules.length; j++) {
    const left = modules[i], right = modules[j], rightFiles = new Set(right.sourceFiles)
    const sharedFiles = left.sourceFiles.filter(path => rightFiles.has(path))
    if (!sharedFiles.length) continue
    overlaps.push({
      modules: [left.id, right.id], sharedFiles,
      shareOfSources: [sharedFiles.length / left.sourceFiles.length, sharedFiles.length / right.sourceFiles.length],
      identicalSourceSets: sharedFiles.length === left.sourceFiles.length && sharedFiles.length === right.sourceFiles.length,
    })
  }
  const covered = new Set(modules.flatMap(module => [...module.sourceFiles, ...module.documents]))
  const excludedPaths = records && files.includes(records) ? [{ path: records, reason: 'Review ledger' }] : []
  const unmappedPaths = candidates.filter(path => {
    if (covered.has(path)) return false
    const exclusion = profile.freshness?.ignore.find(entry => matches(path, entry.path))
    if (!exclusion) return true
    excludedPaths.push({ path, reason: exclusion.reason })
    return false
  })
  coverage.mapping.files = files.length
  coverage.mapping.unmapped = 'informational; assess against requested knowledge scope'
  coverage.mapping.overlaps = 'informational; shared sources require a documented rationale'
  return { modules, overlaps, unmappedPaths, excludedPaths, unsupportedPaths }
}
