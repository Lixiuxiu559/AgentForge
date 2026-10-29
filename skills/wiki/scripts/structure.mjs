import { readFile, readdir, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

const arrayOfNames = value => Array.isArray(value) && value.every(name => typeof name === 'string' && name.trim() && !/[\r\n]/.test(name)) && new Set(value).size === value.length
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const only = (value, keys) => Object.keys(value).every(key => keys.includes(key))
const documentTypes = ['index-small', 'index-modular', 'concepts', 'module', 'rules', 'code-map', 'dependencies', 'guide', 'architecture', 'deployment', 'environments', 'operations', 'troubleshooting']

export function structureConfig(root, value, local) {
  if (value === undefined) return { preset: 'project', documents: [] }
  if (!object(value) || !only(value, ['preset', 'entry', 'documents']) || !['small', 'modular', 'project'].includes(value.preset)) throw new Error('Invalid structure configuration')
  const path = input => {
    const target = local(root, input)
    if (!/\.md$/i.test(target)) throw new Error('Structure paths must name Markdown files')
    return relative(root, target).split(sep).join('/')
  }
  const result = { preset: value.preset, documents: [] }
  if (value.entry !== undefined) result.entry = path(value.entry)
  if (value.documents !== undefined) {
    if (!Array.isArray(value.documents)) throw new Error('structure.documents must be an array')
    const seen = new Set()
    result.documents = value.documents.map(document => {
      if (!object(document) || !only(document, ['path', 'requiredSections', 'type']) || (document.type !== undefined && !documentTypes.includes(document.type)) || (document.requiredSections !== undefined && (!arrayOfNames(document.requiredSections) || !document.requiredSections.length))) throw new Error('Invalid structure document configuration')
      const documentPath = path(document.path)
      if (seen.has(documentPath)) throw new Error('Duplicate structure document path')
      seen.add(documentPath)
      return { path: documentPath, ...(document.type ? { type: document.type } : {}), requiredSections: document.requiredSections ?? [] }
    })
  }
  return result
}

async function schema() {
  const data = JSON.parse(await readFile(new URL('../assets/schema.json', import.meta.url), 'utf8'))
  const types = documentTypes
  if (!object(data) || data.version !== 1 || !object(data.common) || !arrayOfNames(data.common.sections) || !arrayOfNames(data.common.fields) || !arrayOfNames(data.common.states) || !object(data.types) || types.some(type => {
    const definition = data.types[type]
    return !object(definition) || !arrayOfNames(definition.sections) || (definition.fields !== undefined && !arrayOfNames(definition.fields)) || (definition.legacySections !== undefined && (!Array.isArray(definition.legacySections) || definition.legacySections.some(set => !arrayOfNames(set) || !set.length)))
  })) throw new Error('Invalid packaged Wiki structure schema')
  return data
}

function sections(text) {
  // Preserve code examples as section content while excluding their headings.
  const result = new Map()
  let current, fence
  for (const line of text.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = undefined
    }
    if (!fence && /^ {0,3}#\s/.test(line)) { current = undefined; continue }
    const heading = !fence && /^ {0,3}##\s+(.+?)(?:\s+#+)?\s*$/.exec(line)
    if (heading) {
      current = heading[1].trim()
      if (!result.has(current)) result.set(current, [])
    } else if (current) result.get(current).push(line)
  }
  return new Map([...result].map(([heading, lines]) => [heading, lines.join('\n').trim()]))
}

function hasContent(value) {
  const lines = (value ?? '').split('\n')
  const substantive = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(?:#{1,6}[^\n]*|[-*_]{3,}|```[^\n]*|~~~[^\n]*)\s*$/.test(line)) continue
    // A header and separator alone are an unfinished table, not section content.
    if (/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1] ?? '')) { i++; continue }
    if (/^\s*\|(?:\s*\|)*\s*$/.test(line)) continue
    substantive.push(line)
  }
  return Boolean(substantive.join('\n').trim())
}

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function checkDocument(text, path, requiredSections, spec, issue, prose, extraFields = []) {
  const headings = sections(text)
  for (const heading of requiredSections) {
    if (!headings.has(heading)) issue('missing-section', path, `Required H2 section: ${heading}`)
    else if (!hasContent(headings.get(heading))) issue('empty-section', path, `Section has no content: ${heading}`)
  }
  if (!spec) return
  const metadata = new Map()
  const visibleText = prose(text.replace(/(`+)([^`\n]+)\1/g, '$2'))
  const visible = sections(visibleText)
  for (const line of (visible.get('文档信息') ?? '').split('\n')) {
    const row = /^\s*\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|\s*$/.exec(line)
    if (row) metadata.set(row[1].trim(), row[2].trim())
  }
  const placeholder = /\{\{[^{}]+\}\}/
  const titles = visibleText.split('\n').filter(line => /^ {0,3}#\s/.test(line)).join('\n')
  if (placeholder.test(prose(text)) || placeholder.test(titles) || [...metadata.values()].some(value => placeholder.test(value))) issue('unresolved-placeholder', path, 'Replace template placeholders with evidence or explicit unknowns')
  for (const field of [...spec.common.fields, ...extraFields]) if (!metadata.get(field)) issue('missing-document-field', path, `Required document information: ${field}`)
  const state = metadata.get('事实状态'), verified = metadata.get('核验时间')
  if (state && !spec.common.states.includes(state)) issue('invalid-document-state', path, `Unknown fact state: ${state}`)
  if (verified && !(calendarDate(verified) || (state === '草稿' && verified === '未核验'))) issue('invalid-verification-date', path, 'Use a calendar date YYYY-MM-DD, or 未核验 for drafts')
}

export async function checkStructure({ root, wiki, files, profile, texts, graph, navigationTargets, safe, local, prose, issue, coverage }) {
  const structure = profile.structure ?? { preset: 'project', documents: [] }
  const defaults = structure.preset !== 'project'
  const spec = defaults || structure.documents?.some(document => document.type) ? await schema() : undefined
  const requirements = new Map()
  const required = (path, type) => {
    const previous = requirements.get(path)
    requirements.set(path, { type: type ?? previous?.type, sections: previous?.sections ?? [] })
  }
  const wikiPath = path => resolve(wiki, path)
  if (defaults) {
    required(wikiPath('README.md'), `index-${structure.preset}`)
    if (structure.preset === 'modular') {
      if (!structure.documents?.some(document => document.type === 'concepts')) required(wikiPath('concepts.md'), 'concepts')
      let modules = []
      try { modules = (await readdir(await safe(root, wikiPath('modules')), { withFileTypes: true })).filter(entry => entry.isDirectory()) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
      if (!modules.length) issue('missing-modules', relative(root, wiki), 'Modular Wiki requires at least one module directory')
      for (const module of modules) required(wikiPath(`modules/${module.name}/README.md`), 'module')
    }
    for (const file of files) {
      if (requirements.has(file)) continue
      const moduleFile = relative(wiki, file).split(sep).join('/').match(/^modules\/[^/]+\/(rules|code-map|dependencies)\.md$/)
      required(file, moduleFile?.[1] ?? 'guide')
    }
  }
  for (const document of structure.documents ?? []) {
    const path = local(root, document.path)
    required(path, document.type)
    requirements.get(path).sections = document.requiredSections
  }
  coverage.structure = { preset: structure.preset, documents: 0, navigation: 'not_requested', legacyDocuments: [] }
  for (const [path, requirement] of requirements) {
    let actual
    try {
      actual = await safe(root, path)
      if (!(await stat(actual)).isFile()) { issue('invalid-structure-document', relative(root, path), 'Required document must be a file'); continue }
    } catch (error) {
      if (error.code === 'ENOENT') { issue('missing-structure-document', relative(root, path), 'Required Wiki document does not exist'); continue }
      throw error
    }
    const text = texts.get(actual) ?? await readFile(actual, 'utf8')
    const documentSpec = requirement.type ? spec : undefined
    const definition = documentSpec?.types[requirement.type ?? 'guide']
    let typeSections = definition?.sections ?? []
    if (definition?.legacySections) {
      const present = sections(text)
      if (!typeSections.every(heading => present.has(heading))) {
        const legacy = definition.legacySections.find(set => set.every(heading => present.has(heading)))
        if (legacy) {
          typeSections = legacy
          coverage.structure.legacyDocuments.push(relative(root, path))
        }
      }
    }
    const headings = [...new Set([...(documentSpec ? [...documentSpec.common.sections, ...typeSections] : []), ...requirement.sections])]
    checkDocument(text, relative(root, path), headings, documentSpec, issue, prose, definition?.fields)
    coverage.structure.documents++
  }
  const entry = structure.entry ? local(root, structure.entry) : defaults ? wikiPath('README.md') : undefined
  if (!entry) return
  let actualEntry
  try {
    actualEntry = await safe(root, entry)
    if (!(await stat(actualEntry)).isFile()) { issue('invalid-wiki-entry', relative(root, entry), 'Wiki entry must be a file'); return }
  } catch (error) {
    if (error.code === 'ENOENT') { issue('missing-wiki-entry', relative(root, entry), 'Wiki navigation entry does not exist'); return }
    throw error
  }
  coverage.structure.navigation = 'checked'
  const reachable = new Set(), pending = [actualEntry]
  coverage.structure.navigationAdditionalDocuments = 0
  while (pending.length) {
    const next = pending.pop()
    if (reachable.has(next)) continue
    reachable.add(next)
    if (!graph.has(next)) {
      graph.set(next, await navigationTargets(next))
      coverage.structure.navigationAdditionalDocuments++
    }
    for (const target of graph.get(next)) pending.push(target)
  }
  for (const file of files) if (!reachable.has(file)) issue('unreachable-document', relative(root, file), 'Document is not reachable from the Wiki entry through local Markdown links')
}
