export async function loadProfile(fetchProfile, userId, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchProfile(userId, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
