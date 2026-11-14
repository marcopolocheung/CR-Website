type Entry = { href: string; previousHref: string | null }
const stateKey = '__crBackNavigation'
const storageKey = 'cr-last-navigation'

function localHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value, window.location.href)
    return url.origin === window.location.origin ? url.href : null
  } catch { return null }
}

/** Track each browser entry, including hash changes and full loads between root layouts. */
export function trackBackNavigation(update: (previousHref: string | null) => void) {
  const { history } = window
  const push = history.pushState
  const replace = history.replaceState
  let current: Entry
  const read = (): Entry | null => {
    const entry = history.state?.[stateKey]
    return entry && entry.href === window.location.href
      ? { href: entry.href, previousHref: localHref(entry.previousHref) }
      : null
  }
  const remember = () => {
    try { sessionStorage.setItem(storageKey, current.href) } catch { /* Navigation also works without storage. */ }
    update(current.previousHref)
  }
  const write = () => {
    replace.call(history, { ...history.state, [stateKey]: current }, '')
    remember()
  }
  let previousHref: string | null = null
  try {
    const last = localHref(sessionStorage.getItem(storageKey))
    // A referrer alone does not mean this tab has a previous entry (e.g. a new tab).
    if (last && history.length > 1 && document.referrer && new URL(last).href.split('#')[0] === document.referrer.split('#')[0]) {
      previousHref = last
    }
  } catch { /* Direct entries use the page's fallback. */ }
  current = read() ?? { href: window.location.href, previousHref }
  write()

  const pushState: History['pushState'] = function (data, unused, url) {
    const previousHref = window.location.href
    push.call(history, data, unused, url)
    current = { href: window.location.href, previousHref }
    write()
  }
  const replaceState: History['replaceState'] = function (data, unused, url) {
    replace.call(history, data, unused, url)
    current = { ...current, href: window.location.href }
    write()
  }
  history.pushState = pushState
  history.replaceState = replaceState
  const restore = () => {
    current = read() ?? { href: window.location.href, previousHref: current.href }
    write()
  }
  window.addEventListener('popstate', restore)
  window.addEventListener('hashchange', restore)
  window.addEventListener('pageshow', restore)
  return () => {
    if (history.pushState === pushState) history.pushState = push
    if (history.replaceState === replaceState) history.replaceState = replace
    window.removeEventListener('popstate', restore)
    window.removeEventListener('hashchange', restore)
    window.removeEventListener('pageshow', restore)
  }
}
