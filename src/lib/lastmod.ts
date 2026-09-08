import { execFileSync } from 'node:child_process'

/**
 * Only reached when git cannot answer — a tarball export, or a checkout so
 * shallow that no commit touching the route is present. It is deliberately a
 * fixed past date rather than `new Date()`: a build-time now would tell search
 * engines every page changed on every deploy, which is exactly the claim that
 * gets `lastmod` ignored.
 */
const FALLBACK = '2026-08-22T00:00:00.000Z'

const cache = new Map<string, Date>()

/**
 * The commit date of the most recent change to any file that renders this
 * route. Server-only: this module shells out to git and must never be pulled
 * into a client bundle.
 */
export function lastModifiedFor(sources: readonly string[]): Date {
  const paths = [...new Set(sources)].sort()
  const key = paths.join('\0')
  const cached = cache.get(key)
  if (cached) return cached

  const resolved = new Date(gitLastCommitDate(paths) ?? FALLBACK)
  cache.set(key, resolved)
  return resolved
}

function gitLastCommitDate(paths: readonly string[]): string | null {
  try {
    const stdout = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', ...paths],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()

    if (!stdout) {
      warnOnce(`no commit found for ${paths.join(', ')}`)
      return null
    }
    return stdout
  } catch {
    warnOnce('git is unavailable; sitemap lastmod is falling back to a fixed date')
    return null
  }
}

const warned = new Set<string>()

function warnOnce(message: string) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[sitemap] ${message}`)
}
