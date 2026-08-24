import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outDir = path.join(root, 'out')
const siteUrl = 'https://chinarosesa.com'

// requiresJsonLd marks the pages whose entity data we depend on for rich
// results; every page's JSON-LD is validated when present either way.
const publicPages = [
  { route: '/', file: 'index.html', requiresJsonLd: true },
  { route: '/menu', file: 'menu.html' },
  { route: '/locations/w-military', file: 'locations/w-military.html', requiresJsonLd: true },
  { route: '/locations/sw-military', file: 'locations/sw-military.html', requiresJsonLd: true },
  { route: '/careers', file: 'careers.html' },
]

const noindexPages = [
  'order.html',
  'order/review.html',
  'order/confirmation.html',
  'internal/qr-generator.html',
]

function fail(message) {
  console.error(`SEO check failed: ${message}`)
  process.exitCode = 1
}

function readOut(relativePath) {
  const fullPath = path.join(outDir, relativePath)
  if (!fs.existsSync(fullPath)) {
    fail(`missing out/${relativePath}`)
    return ''
  }
  return fs.readFileSync(fullPath, 'utf8')
}

function checkHeadings(file, html) {
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]))
  const h1Count = levels.filter((level) => level === 1).length

  if (h1Count !== 1) fail(`${file} has ${h1Count} h1 elements, expected exactly 1`)

  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] > levels[i - 1] + 1) {
      fail(`${file} skips from h${levels[i - 1]} to h${levels[i]}`)
      break
    }
  }
}

// Walks every nested value so references buried in arrays are checked too.
function walkNodes(value, visit) {
  if (Array.isArray(value)) {
    for (const entry of value) walkNodes(entry, visit)
  } else if (value && typeof value === 'object') {
    visit(value)
    for (const entry of Object.values(value)) walkNodes(entry, visit)
  }
}

function checkJsonLd(file, html, required) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
  if (blocks.length === 0) {
    if (required) fail(`${file} has no JSON-LD`)
    return
  }

  for (const [, raw] of blocks) {
    let data
    try {
      data = JSON.parse(raw.replaceAll('\\u003c', '<'))
    } catch {
      fail(`${file} has unparseable JSON-LD`)
      continue
    }

    const graph = data['@graph'] ?? [data]
    const defined = new Set(graph.map((node) => node['@id']).filter(Boolean))

    for (const node of graph) {
      if (!node['@type']) fail(`${file} JSON-LD has a top-level node with no @type`)
    }

    // A bare {"@id": ...} pointing outside this page resolves to nothing: search
    // engines read structured data one page at a time.
    walkNodes(graph, (node) => {
      const id = node['@id']
      if (!id || node['@type'] || defined.has(id)) return
      fail(`${file} JSON-LD references ${id}, which is untyped and not defined on this page`)
    })

    for (const node of graph) {
      if (node['@type'] !== 'Restaurant') continue
      for (const field of ['name', 'address', 'telephone', 'openingHoursSpecification', 'url', 'geo', 'sameAs']) {
        if (!node[field]) fail(`${file} Restaurant JSON-LD missing ${field}`)
      }
      if (node.menu) fail(`${file} Restaurant JSON-LD uses superseded "menu"; use hasMenu`)
      if (node.branchOf) fail(`${file} Restaurant JSON-LD uses superseded "branchOf"; use parentOrganization`)
      // A maps *search* URL is not a profile identifier and reconciles to nothing.
      for (const url of node.sameAs ?? []) {
        if (url.includes('/maps/search/')) fail(`${file} Restaurant sameAs uses a maps search URL: ${url}`)
      }
    }
  }
}

function canonicalFor(route) {
  if (route === '/') return siteUrl
  return new URL(route, siteUrl).toString()
}

function sitemapLocFor(route) {
  return new URL(route, siteUrl).toString()
}

if (!fs.existsSync(outDir)) {
  fail('missing out/ directory; run npm run build first')
} else {
  const robots = readOut('robots.txt')
  if (!robots.includes('Sitemap: https://chinarosesa.com/sitemap.xml')) fail('robots.txt missing sitemap')
  if (robots.includes('Disallow: /internal/') || robots.includes('Disallow: /order/')) {
    fail('robots.txt blocks noindexed pages from being crawled')
  }
  if (robots.includes('Host:')) fail('robots.txt should not emit Host directive')
  if (!robots.includes('User-Agent: OAI-SearchBot')) fail('robots.txt missing OAI-SearchBot rule')
  if (!robots.includes('User-Agent: GPTBot')) fail('robots.txt missing GPTBot rule')

  const sitemap = readOut('sitemap.xml')
  for (const page of publicPages) {
    const loc = `<loc>${sitemapLocFor(page.route)}</loc>`
    if (!sitemap.includes(loc)) fail(`sitemap.xml missing ${loc}`)
  }
  if (sitemap.includes('/order') || sitemap.includes('/internal')) {
    fail('sitemap.xml includes internal or order routes')
  }

  for (const page of publicPages) {
    const html = readOut(page.file)
    const canonical = `<link rel="canonical" href="${canonicalFor(page.route)}"/>`
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.trim()
    if (!title || title === 'China Rose' || title.startsWith('404:')) {
      fail(`${page.file} has missing or default title`)
    }
    if (!html.includes('name="description"')) fail(`${page.file} missing meta description`)
    if (!html.includes(canonical)) fail(`${page.file} missing canonical ${canonical}`)
    if (!html.includes('property="og:title"')) fail(`${page.file} missing Open Graph title`)
    if (!html.includes('property="og:description"')) fail(`${page.file} missing Open Graph description`)
    if (html.includes('content="noindex')) fail(`${page.file} is accidentally noindexed`)
    checkJsonLd(page.file, html, page.requiresJsonLd)
    checkHeadings(page.file, html)
  }

  for (const file of noindexPages) {
    const html = readOut(file)
    if (!html.includes('name="robots"') || !html.includes('noindex')) {
      fail(`${file} missing noindex robots meta`)
    }
  }
}

if (!process.exitCode) {
  console.log('SEO check passed')
}
