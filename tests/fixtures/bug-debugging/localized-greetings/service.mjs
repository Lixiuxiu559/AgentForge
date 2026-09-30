export function createGreetingService() {
  const cache = new Map()
  const prefixes = { zh: '你好', en: 'Hello' }

  return function greet(name, locale) {
    if (!Object.hasOwn(prefixes, locale)) throw new Error('不支持的语言')
    if (cache.has(name)) return cache.get(name)
    const greeting = `${prefixes[locale]}, ${name}`
    cache.set(name, greeting)
    return greeting
  }
}
