import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outDir = path.join(root, 'out')
const siteUrl = 'https://chinarosesa.com'

const publicPages = [
  { route: '/', file: 'index.html', title: 'China Rose | Authentic Chinese Cuisine in San Antonio' },
  { route: '/menu', file: 'menu.html', title: 'Menu | China Rose' },
  { route: '/locations/w-military', file: 'locations/w-military.html', title: 'W Military Dr | China Rose' },
  { route: '/locations/sw-military', file: 'locations/sw-military.html', title: 'SW Military Dr | China Rose' },
  { route: '/careers', file: 'careers.html', title: 'Careers | China Rose' },
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
  if (!robots.includes('Disallow: /internal/')) fail('robots.txt missing /internal/ disallow')
  if (!robots.includes('Disallow: /order/')) fail('robots.txt missing /order/ disallow')
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
    if (!html.includes(`<title>${page.title}</title>`)) fail(`${page.file} has wrong or missing title`)
    if (!html.includes('name="description"')) fail(`${page.file} missing meta description`)
    if (!html.includes(canonical)) fail(`${page.file} missing canonical ${canonical}`)
    if (!html.includes('property="og:title"')) fail(`${page.file} missing Open Graph title`)
    if (!html.includes('property="og:description"')) fail(`${page.file} missing Open Graph description`)
    if (html.includes('content="noindex')) fail(`${page.file} is accidentally noindexed`)
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
