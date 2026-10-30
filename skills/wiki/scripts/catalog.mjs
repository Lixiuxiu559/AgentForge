// catalog.json (version 2) is the single structural source of a generated wiki:
// page tree, per-page sources and summaries, document and path languages.
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { prose as stripCode, tokens, verdict } from './scan.mjs'

const TOP = ['version', 'title', 'language', 'pathLanguage', 'pages']
const PAGE = ['id', 'title', 'path', 'summary', 'sources', 'children', 'status']
const text = value => typeof value === 'string' && value.trim() !== ''
const posix = path => path.split(sep).join('/')
// Pages backed by more files than this usually answer several questions at once.
const SOURCE_LIMIT = 15

export function parseCatalog(raw, { root, wiki, local }) {
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('catalog.json must be an object')
  const extra = Object.keys(data).filter(key => !TOP.includes(key))
  if (extra.length) throw new Error(`catalog.json has unknown fields: ${extra.join(', ')}`)
  if (data.version !== 2) throw new Error('catalog.json requires version: 2')
  for (const key of ['title', 'language', 'pathLanguage']) if (!text(data[key])) throw new Error(`catalog.json requires ${key}`)
  if (!Array.isArray(data.pages) || !data.pages.length) throw new Error('catalog.json requires a nonempty pages array')
  const ids = new Set(), paths = new Set()
  for (const page of data.pages) {
    if (!page || typeof page !== 'object' || Array.isArray(page)) throw new Error('Each catalog page must be an object')
    const unknown = Object.keys(page).filter(key => !PAGE.includes(key))
    if (unknown.length) throw new Error(`Page ${page.id ?? '?'} has unknown fields: ${unknown.join(', ')}`)
    for (const key of ['id', 'title', 'path', 'summary']) if (!text(page[key])) throw new Error(`Page ${page.id ?? '?'} requires ${key}`)
    if (ids.has(page.id)) throw new Error(`Duplicate page id: ${page.id}`)
    ids.add(page.id)
    if (!/\.md$/i.test(page.path)) throw new Error(`Page ${page.id}: path must be a Markdown file`)
    const target = local(root, posix(join(wiki, page.path)))
    if (!target.startsWith(resolve(root, wiki) + sep)) throw new Error(`Page ${page.id}: path escapes the wiki directory`)
    page.path = posix(relative(resolve(root, wiki), target))
    if (paths.has(page.path)) throw new Error(`Duplicate page path: ${page.path}`)
    paths.add(page.path)
    if (!Array.isArray(page.sources) || page.sources.some(source => !text(source))) throw new Error(`Page ${page.id}: sources must be an array of project-relative paths`)
    page.sources = page.sources.map(source => posix(relative(root, local(root, source.replace(/\/+$/, '')))))
    if (page.children !== undefined && (!Array.isArray(page.children) || page.children.some(child => !text(child)))) throw new Error(`Page ${page.id}: children must be an array of page paths`)
    if (page.status !== undefined && page.status !== 'planned') throw new Error(`Page ${page.id}: status may only be "planned"`)
  }
  for (const page of data.pages) for (const child of page.children ?? []) {
    if (!paths.has(child)) throw new Error(`Page ${page.id}: child ${child} is not a catalog page`)
  }
  return data
}

// First H1 and the first blockquote line directly after it form the page head.
export function pageHead(content) {
  const lines = stripCode(content).split('\n')
  const start = lines.findIndex(line => /^ {0,3}#\s+\S/.test(line))
  if (start < 0) return { title: null, summary: null }
  const title = lines[start].replace(/^ {0,3}#\s+/, '').replace(/\s+#*\s*$/, '').trim()
  let i = start + 1
  while (i < lines.length && !lines[i].trim()) i++
  const quote = []
  while (i < lines.length && /^ {0,3}>/.test(lines[i])) quote.push(lines[i++].replace(/^ {0,3}>\s?/, ''))
  return { title, summary: quote.join(' ').trim() || null }
}

export function pageLanguage(content) {
  return verdict(tokens(stripCode(content).replace(/<[^>]+>/g, '')))
}
const family = language => /^zh/i.test(language) ? 'zh-CN' : /^en/i.test(language) ? 'en' : null
const normalize = value => value.replace(/\s+/g, ' ').trim()

// Mechanical consistency between catalog.json and the files on disk; semantic
// accuracy of page content stays with the agent.
export async function checkCatalog({ root, wiki, files, texts, graph, catalog, safe, issue, limited, coverage }) {
  const base = resolve(root, wiki), name = path => posix(relative(root, path))
  const pages = new Map(catalog.pages.map(page => [resolve(base, page.path), page]))
  const expected = family(catalog.language)
  if (!expected) limited(`Page language check supports Chinese and English only: ${catalog.language}`)
  coverage.catalog = { pages: catalog.pages.length, planned: catalog.pages.filter(page => page.status === 'planned').length, oversized: [] }
  const readme = resolve(base, 'README.md')
  for (const [file, page] of pages) {
    const where = posix(join(wiki, page.path))
    let count = 0
    for (const source of page.sources) {
      try { count += await sourceFiles(await safe(root, resolve(root, source))) }
      catch (error) { if (error.code === 'ENOENT') issue('missing-source', where, `${page.id}: source not found: ${source}`); else throw error }
    }
    // Advisory only: the overview page legitimately spans the whole project.
    if (file !== readme && count > SOURCE_LIMIT) coverage.catalog.oversized.push({ id: page.id, path: where, sourceFiles: count })
    if (!texts.has(file)) {
      if (page.status !== 'planned') issue('missing-page', where, `${page.id}: catalog page not found`)
      continue
    }
    if (page.status === 'planned') issue('planned-page-exists', where, `${page.id}: generated page is still marked planned`)
    const content = texts.get(file), head = pageHead(content)
    if (!head.title) issue('missing-title', where, `${page.id}: page needs a level-1 heading`)
    if (!head.summary) issue('missing-summary', where, `${page.id}: a blockquote summary must follow the title`)
    else if (normalize(head.summary) !== normalize(page.summary)) issue('summary-mismatch', where, `${page.id}: page summary differs from catalog.json`)
    const found = expected && pageLanguage(content)
    if (found && found !== expected) issue('language-mismatch', where, `${page.id}: page prose reads as ${found}, catalog language is ${catalog.language}`)
  }
  for (const file of files) {
    if (file !== readme && !pages.has(file)) issue('uncatalogued-page', name(file), 'Markdown page is not listed in catalog.json')
  }
  if (!texts.has(readme)) { issue('missing-readme', posix(join(wiki, 'README.md')), 'Wiki needs README.md as its entry'); return }
  const seen = new Set([readme]), queue = [readme]
  while (queue.length) for (const next of graph.get(queue.shift()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next) }
  for (const [file, page] of pages) {
    if (texts.has(file) && !seen.has(file)) issue('unreachable-page', posix(join(wiki, page.path)), `${page.id}: not reachable from README.md`)
  }
}

async function sourceFiles(path) {
  if (!(await stat(path)).isDirectory()) return 1
  const entries = await readdir(path, { recursive: true, withFileTypes: true })
  return entries.filter(entry => entry.isFile()).length
}

export async function readCatalog({ root, wiki, local, safe }) {
  const path = resolve(root, wiki, 'catalog.json')
  try { await stat(path) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
  return parseCatalog(await readFile(await safe(root, path), 'utf8'), { root, wiki, local })
}
