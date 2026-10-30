#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { checkStructure, structureConfig } from './structure.mjs'
import { freshnessConfig, runFreshness } from './freshness.mjs'
import { inspectMapping } from './mapping.mjs'
import { scan } from './scan.mjs'
import { checkCatalog, readCatalog } from './catalog.mjs'

const coverage = { semantic: 'not_run', limitations: [] }
const findings = []
const issue = (code, path, message) => findings.push({ code, path, message })
const limited = message => { if (!coverage.limitations.includes(message)) coverage.limitations.push(message) }
function args() {
  const [command, ...tokens] = process.argv.slice(2)
  if (!['scan', 'check', 'changes', 'mapping', 'freshness', 'review', 'gate'].includes(command)) throw new Error('Expected scan, check, changes, mapping, freshness, review, or gate')
  const result = { command }
  const allowed = {
    scan: ['root', 'wiki'],
    check: ['root', 'wiki', 'config'],
    changes: ['root', 'scope', 'base', 'head', 'config'],
    mapping: ['root', 'config', 'document'],
    freshness: ['root', 'config', 'module'],
    review: ['root', 'config', 'module', 'decision', 'reason', 'reviewer', 'evidence', 'scope'],
    gate: ['root', 'config', 'scope', 'base', 'head'],
  }[command]
  for (let i = 0; i < tokens.length; i += 2) {
    const key = tokens[i].replace(/^--/, '')
    if (tokens[i] !== `--${key}` || !allowed.includes(key) || key in result || !tokens[i + 1] || tokens[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${tokens[i]}`)
    result[key] = tokens[i + 1]
  }
  if (command === 'scan' && !result.root) result.root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', env: gitEnvironment, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  if (!result.root || !isAbsolute(result.root)) throw new Error('--root must be an absolute project path')
  return result
}
function inside(root, path) {
  const rel = relative(root, path)
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}
function local(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') || path.includes('\0')) throw new Error(`Expected a project-relative path: ${path}`)
  const target = resolve(root, path)
  if (!inside(root, target)) throw new Error(`Path escapes project: ${path}`)
  return target
}
async function safe(root, path) {
  const actual = await realpath(path)
  if (!inside(root, actual)) throw new Error(`Symbolic link escapes project: ${relative(root, path)}`)
  return actual
}
async function config(root, path) {
  if (!path) return { modules: [], structure: structureConfig(root, undefined, local) }
  return parseConfig(root, await readFile(await safe(root, local(root, path)), 'utf8'), relative(root, local(root, path)).split(sep).join('/'))
}
function parseConfig(root, text, configPath) {
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object' || Object.keys(data).some(key => !['version', 'modules', 'structure', 'freshness'].includes(key)) || data.version !== 1 || !Array.isArray(data.modules)) throw new Error('Config requires version: 1 and modules: []')
  data.structure = structureConfig(root, data.structure, local)
  const ids = new Set()
  for (const mod of data.modules) {
    if (!mod || Object.keys(mod).some(key => !['id', 'sources', 'docs'].includes(key)) || typeof mod.id !== 'string' || !mod.id.trim() || ids.has(mod.id)) throw new Error('Module IDs must be nonempty and unique')
    ids.add(mod.id)
    for (const field of ['sources', 'docs']) {
      if (!Array.isArray(mod[field]) || mod[field].some(p => typeof p !== 'string' || /[*?\[\]]/.test(p))) throw new Error(`${mod.id}.${field} requires literal relative paths (no globs)`)
      mod[field] = mod[field].map(p => relative(root, local(root, p)).split(sep).join('/') || '.')
    }
  }
  data.freshness = freshnessConfig(root, data.freshness, local, data.modules, configPath)
  return data
}
async function markdownFiles(root, directory, seen = new Set()) {
  const actual = await safe(root, directory)
  if (seen.has(actual)) { limited('Repeated directory or symbolic-link cycle skipped'); return [] }
  seen.add(actual)
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    // Do not follow symlinks while traversing a knowledge tree.
    if (entry.isSymbolicLink()) { limited(`Symbolic link skipped: ${relative(root, path)}`); continue }
    if (entry.isDirectory()) files.push(...await markdownFiles(root, path, seen))
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(path)
  }
  return files
}
function prose(text, source = 'document') {
  let fence = null, listContext = false
  return text.split(/\r?\n/).map(line => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (match) {
      if (!fence) fence = match[1]
      else if (match[1][0] === fence[0] && match[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = null
      return ''
    }
    if (fence) return ''
    if (/^(?: {4}|\t)/.test(line)) {
      // Indentation can mean code or nested list content. Do not pretend to parse
      // CommonMark containers; retain a coverage gap instead of dropping links.
      if (listContext && /\[|<(?:a|img)\b/i.test(line)) limited(`Indented list content requires manual link verification: ${source}`)
      return ''
    }
    if (line.trim()) listContext = /^ {0,3}(?:[-+*]|\d+[.)])\s/.test(line)
    return line.replace(/(`+)[\s\S]*?\1/g, '')
  }).join('\n').replace(/<!--[\s\S]*?-->/g, '')
}
function anchors(text) {
  const result = new Set(), counts = new Map()
  const lines = prose(text.replace(/(`+)([^`\n]+)\1/g, '$2')).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const atx = lines[i].match(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/)
    const title = atx?.[1] ?? (i + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) ? lines[i].trim() : null)
    if (!title) continue
    // Common GitHub-style slugs, not a complete Markdown renderer.
    const base = title.toLowerCase().replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    result.add(count ? `${base}-${count}` : base)
  }
  for (const match of prose(text).matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1])
  return result
}
function links(text, path) {
  const body = prose(text, path), out = [], definitions = new Map()
  const definitionPattern = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))(?:\s+["'(].*)?$/gm
  for (const match of body.matchAll(definitionPattern)) definitions.set(match[1].toLowerCase().replace(/\s+/g, ' '), match[2] ?? match[3])
  let remaining = body.replace(definitionPattern, '')
  const inline = /(!?)\[([^\]\n]*)\]\(\s*(?:<([^>\n]*)>|([^\s()]*))(?:\s+["'][^\n]*?["'])?\s*\)/g
  remaining = remaining.replace(inline, (_, image, label, bracketed, plain) => { out.push({ href: bracketed ?? plain, image: Boolean(image) }); return '' })
  remaining = remaining.replace(/(!?)\[([^\]\n]+)\]\[([^\]\n]*)\]/g, (_, image, label, id) => {
    const target = definitions.get((id || label).toLowerCase().replace(/\s+/g, ' '))
    if (target === undefined) issue('missing-reference', path, `Undefined link reference: ${id || label}`)
    else out.push({ href: target, image: Boolean(image) })
    return ''
  })
  remaining = remaining.replace(/(!?)\[([^\]\n]+)\]/g, (original, image, id) => {
    const target = definitions.get(id.toLowerCase().replace(/\s+/g, ' '))
    if (target !== undefined) { out.push({ href: target, image: Boolean(image) }); return '' }
    return original
  })
  if (/!?\[[^\n]*\]\(/.test(remaining) || /<(?:a|img)\b/i.test(body) || /\{[#.][^}]+\}/.test(body)) limited(`Unsupported complex Markdown/HTML syntax: ${path}`)
  return out
}
async function check(root, options, profile) {
  if (!options.wiki) options.wiki = 'docs/wiki'
  const wiki = await safe(root, local(root, options.wiki))
  if (!(await stat(wiki)).isDirectory()) throw new Error('--wiki must be a directory')
  const wikiPath = relative(root, wiki).split(sep).join('/')
  const catalog = await readCatalog({ root, wiki: wikiPath, local, safe })
  const files = await markdownFiles(root, wiki)
  coverage.files = files.length
  coverage.links = 0
  coverage.externalLinks = 0
  coverage.anchorStyle = 'common-github-slugs; custom renderers require manual verification'
  coverage.nonMarkdownAnchors = 0
  if (!files.length) issue('empty-wiki', options.wiki, 'No Markdown documents found')
  for (const mod of profile.modules) for (const field of ['docs', 'sources']) for (const p of mod[field]) {
    try {
      const target = await safe(root, local(root, p))
      if (field === 'docs' && !(await stat(target)).isFile()) issue('invalid-doc', p, `${mod.id}: document must be a file`)
    } catch (error) {
      if (error.code === 'ENOENT') issue('missing-config-path', p, `${mod.id}.${field}: path not found`)
      else throw error
    }
  }
  const texts = new Map(), graph = new Map()
  for (const file of files) {
    const name = relative(root, file), content = await readFile(file, 'utf8')
    texts.set(file, content)
    graph.set(file, new Set())
    if (!content.trim()) issue('empty-document', name, 'Document is empty')
    for (const { href, image } of links(content, name)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) { coverage.externalLinks++; continue }
      coverage.links++
      const [pathPart, ...fragmentParts] = href.split('#')
      const fragment = fragmentParts.join('#')
      let decoded, anchor
      try { decoded = decodeURIComponent(pathPart.split('?')[0]); anchor = decodeURIComponent(fragment) }
      catch { issue('invalid-link', name, `Invalid URL encoding: ${href}`); continue }
      if (!href) { issue('empty-link', name, 'Empty link destination'); continue }
      if (decoded.startsWith('/')) { limited(`Site-root link requires site adapter: ${name}: ${href}`); continue }
      const target = resolve(dirname(file), decoded || '')
      const destination = decoded ? target : file
      if (!inside(root, destination)) { limited(`Outside-project link skipped: ${name}: ${href}`); continue }
      let actual
      try { actual = await safe(root, destination) }
      catch (error) {
        if (error.code === 'ENOENT') { issue('broken-link', name, `Target not found: ${href}`); continue }
        throw error
      }
      if (!image && /\.md$/i.test(actual) && (await stat(actual)).isFile()) graph.get(file).add(actual)
      if (anchor) {
        if (!/\.md$/i.test(actual)) { coverage.nonMarkdownAnchors++; continue }
        const targetText = actual === file ? content : await readFile(actual, 'utf8')
        if (!anchors(targetText).has(anchor)) {
          const lines = prose(targetText).split('\n')
          const headings = lines.filter((line, i) => /^ {0,3}#{1,6}\s/.test(line) || /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1] ?? '')).join('\n')
          if (/[<&\[\]\\{}]/.test(headings)) limited(`Complex heading anchors require renderer verification: ${name}: ${href}`)
          else issue('missing-anchor', name, `Anchor not found: ${href}`)
        }
      }
    }
  }
  const navigationTargets = async file => {
    const content = texts.get(file) ?? await readFile(file, 'utf8')
    const targets = new Set()
    for (const { href, image } of links(content, relative(root, file))) {
      if (image) continue
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue
      let path
      try { path = decodeURIComponent(href.split('#')[0].split('?')[0]) }
      catch { issue('invalid-link', relative(root, file), `Invalid URL encoding: ${href}`); continue }
      if (!path || path.startsWith('/')) continue
      const candidate = resolve(dirname(file), path)
      if (!inside(root, candidate)) { limited(`Outside-project navigation link skipped: ${relative(root, file)}: ${href}`); continue }
      let actual
      try { actual = await safe(root, candidate) }
      catch (error) {
        if (error.code === 'ENOENT') { issue('broken-link', relative(root, file), `Target not found: ${href}`); continue }
        throw error
      }
      if (/\.md$/i.test(actual) && (await stat(actual)).isFile()) targets.add(actual)
    }
    return targets
  }
  if (catalog) await checkCatalog({ root, wiki: wikiPath, files, texts, graph, catalog, safe, issue, limited, coverage })
  else await checkStructure({ root, wiki, files, profile, texts, graph, navigationTargets, safe, local, prose, issue, coverage })
  return { wiki: relative(root, wiki), ...(catalog ? { language: catalog.language, pathLanguage: catalog.pathLanguage } : {}) }
}
const gitEnvironment = { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
// Host commands (including hooks) can export another repository or index. Keep
// PATH and ordinary/system Git configuration, but discard inherited local context.
for (const key of Object.keys(gitEnvironment)) {
  if (/^GIT_(?:DIR|COMMON_DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|GRAFT_FILE|SHALLOW_FILE|NAMESPACE|REPLACE_REF_BASE|NO_REPLACE_OBJECTS|IMPLICIT_WORK_TREE|PREFIX|CEILING_DIRECTORIES|DISCOVERY_ACROSS_FILESYSTEM|CONFIG|CONFIG_PARAMETERS|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/.test(key)) delete gitEnvironment[key]
}
function git(root, parameters, binary = false) {
  return execFileSync('git', ['-C', root, ...parameters], { encoding: binary ? undefined : 'utf8', maxBuffer: 32 * 1024 * 1024, env: gitEnvironment, stdio: ['ignore', 'pipe', 'pipe'] })
}
function revision(root, ref) {
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim()
}
function parseChanges(raw) {
  const fields = raw.split('\0'), changes = []
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++]
    const first = fields[i++]
    if (!first) throw new Error('Malformed Git name-status output')
    if (/^[RC]/.test(status)) {
      const path = fields[i++]
      if (!path) throw new Error('Malformed Git rename output')
      changes.push({ status, oldPath: first, path })
    } else changes.push({ status, path: first })
  }
  return changes
}
function matches(path, source) { return source === '.' || path === source || path.startsWith(`${source}/`) }
function changes(root, options, profile) {
  if (!['staged', 'worktree', 'range'].includes(options.scope)) throw new Error('--scope must be staged, worktree, or range')
  const gitRoot = git(root, ['rev-parse', '--show-toplevel']).trim()
  if (resolve(gitRoot) !== root) throw new Error('--root must be the Git repository root')
  let parameters, baseline, head
  if (options.scope === 'range') {
    if (!options.base) throw new Error('range requires --base')
    head = revision(root, options.head || 'HEAD')
    baseline = git(root, ['merge-base', revision(root, options.base), head]).trim()
    parameters = [baseline, head]
  } else {
    if (options.base || options.head) throw new Error('--base/--head only apply to range')
    parameters = options.scope === 'staged' ? ['--cached'] : []
    if (options.scope === 'staged') {
      try { baseline = revision(root, 'HEAD') }
      catch {
        const branch = git(root, ['symbolic-ref', '-q', 'HEAD']).trim()
        const ref = spawnSync('git', ['-C', root, 'show-ref', '--verify', '--quiet', branch], { encoding: 'utf8', env: gitEnvironment })
        if (ref.status !== 1) throw new Error('Unable to resolve HEAD baseline')
        baseline = 'empty-tree (unborn branch)'
      }
    } else baseline = 'index (snapshot at collection time)' 
  }
  const entries = parseChanges(git(root, ['diff', '--name-status', '-z', '--find-renames', ...parameters, '--']))
  if (options.scope === 'worktree') for (const path of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) entries.push({ status: '?', path })
  for (const entry of entries) entry.modules = profile.modules.filter(mod => mod.sources.some(source => matches(entry.path, source) || (entry.oldPath && matches(entry.oldPath, source))) || mod.docs.some(doc => entry.path === doc || entry.oldPath === doc)).map(mod => mod.id)
  const unmapped = entries.filter(entry => !entry.modules.length).map(entry => entry.path)
  coverage.scope = options.scope
  coverage.files = entries.length
  coverage.mapping = profile.modules.length ? 'configured-prefixes' : 'not_configured'
  if (unmapped.length) limited('Changed files without configured module mapping require agent review')
  return { baseline, ...(head ? { head } : {}), changes: entries, unmapped }
}
try {
  const options = args(), root = await realpath(resolve(options.root))
  let result
  if (options.command === 'scan') {
    const wiki = relative(root, local(root, options.wiki || 'docs/wiki')).split(sep).join('/')
    result = await scan({ root, wiki, git, limited })
  } else if (['freshness', 'review', 'gate'].includes(options.command)) {
    result = await runFreshness({ root, options, parseConfig, local, git, revision, parseChanges, coverage, issue, limited })
  } else {
    const profile = await config(root, options.config)
    if (options.command === 'mapping') result = await inspectMapping({ root, profile, git, coverage, issue, limited, ...(options.document ? { document: relative(root, local(root, options.document)).split(sep).join('/') } : {}) })
    else result = options.command === 'check' ? await check(root, options, profile) : changes(root, options, profile)
  }
  const status = findings.length ? 'issues' : coverage.limitations.length ? 'partial' : 'passed'
  console.log(JSON.stringify({ status, root, findings, coverage, ...result }, null, 2))
  process.exitCode = status === 'passed' ? 0 : 1
} catch (error) {
  // Avoid exposing child process output or complete configuration documents.
  const message = error instanceof SyntaxError ? 'Invalid JSON configuration' : error.stderr !== undefined ? `Git command failed (${error.status ?? error.code})` : error.message
  console.log(JSON.stringify({ status: 'error', findings: [...findings, { code: 'execution-error', message }], coverage }, null, 2))
  process.exitCode = 2
}
