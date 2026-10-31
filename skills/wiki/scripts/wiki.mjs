#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { scan } from './scan.mjs'
import { checkCatalog, readCatalog } from './catalog.mjs'

const coverage = { semantic: 'not_run', limitations: [] }
const findings = []
const issue = (code, path, message) => findings.push({ code, path, message })
const limited = message => { if (!coverage.limitations.includes(message)) coverage.limitations.push(message) }
function args() {
  const [command, ...tokens] = process.argv.slice(2)
  if (!['scan', 'check'].includes(command)) throw new Error('Expected scan or check')
  const result = { command }
  for (let i = 0; i < tokens.length; i += 2) {
    const key = tokens[i].replace(/^--/, '')
    if (tokens[i] !== `--${key}` || !['root', 'wiki'].includes(key) || key in result || !tokens[i + 1] || tokens[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${tokens[i]}`)
    result[key] = tokens[i + 1]
  }
  if (!result.root) {
    try { result.root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', env: gitEnvironment, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
    catch { throw new Error('--root is required outside a Git repository') }
  }
  if (!isAbsolute(result.root)) throw new Error('--root must be an absolute project path')
  result.wiki ??= 'docs/wiki'
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
async function check(root, options) {
  const wiki = await safe(root, local(root, options.wiki))
  if (!(await stat(wiki)).isDirectory()) throw new Error('--wiki must be a directory')
  const wikiPath = relative(root, wiki).split(sep).join('/')
  const catalog = await readCatalog({ root, wiki: wikiPath, local, safe })
  if (!catalog) throw new Error(`${wikiPath}/catalog.json not found; generate the wiki first`)
  const files = await markdownFiles(root, wiki)
  coverage.files = files.length
  coverage.links = 0
  coverage.externalLinks = 0
  coverage.anchorStyle = 'common-github-slugs; custom renderers require manual verification'
  coverage.nonMarkdownAnchors = 0
  if (!files.length) issue('empty-wiki', options.wiki, 'No Markdown documents found')
  const texts = new Map(), graph = new Map(), codeLinks = new Map()
  for (const file of files) {
    const name = relative(root, file), content = await readFile(file, 'utf8')
    texts.set(file, content)
    graph.set(file, new Set())
    codeLinks.set(file, new Set())
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
      // Markdown targets feed reachability; other linked files count toward a catalog page's breadth.
      if (!image && (await stat(actual)).isFile()) (/\.md$/i.test(actual) ? graph : codeLinks).get(file).add(actual)
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
  await checkCatalog({ root, wiki: wikiPath, files, texts, graph, codeLinks, catalog, safe, issue, limited, coverage })
  return { wiki: wikiPath, language: catalog.language, pathLanguage: catalog.pathLanguage }
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
try {
  const options = args(), root = await realpath(resolve(options.root))
  const result = options.command === 'scan'
    ? await scan({ root, wiki: relative(root, local(root, options.wiki)).split(sep).join('/'), git, limited })
    : await check(root, options)
  const status = findings.length ? 'issues' : coverage.limitations.length ? 'partial' : 'passed'
  console.log(JSON.stringify({ status, root, findings, coverage, ...result }, null, 2))
  process.exitCode = status === 'passed' ? 0 : 1
} catch (error) {
  // Avoid exposing child process output or complete configuration documents.
  const message = error instanceof SyntaxError ? 'Invalid JSON in catalog.json' : error.stderr !== undefined ? `Git command failed (${error.status ?? error.code})` : error.message
  console.log(JSON.stringify({ status: 'error', findings: [...findings, { code: 'execution-error', message }], coverage }, null, 2))
  process.exitCode = 2
}
