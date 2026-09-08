// GitHub Pages serves the static export by exact filename, so `out/menu.html`
// answers /menu and nothing answers /menu/ — a 404 for every inbound link,
// directory listing or person that adds the slash.
//
// This mirrors each indexable page to `<route>/index.html` so both forms return
// 200. The copy is byte-identical, so it carries the same canonical pointing at
// the unslashed form: search engines consolidate the pair instead of indexing
// two URLs, and no already-indexed URL has to move.
//
// The alternative — `trailingSlash: true` — would make the slashed form the only
// one, which is tidier but migrates all five live URLs at once and depends on
// GitHub Pages issuing the 301 it is expected to. Not worth the risk here.
//
// Routes come from the generated sitemap, so this cannot drift from the set of
// pages we actually publish, and staff/order routes are never mirrored.

import fs from 'node:fs'
import path from 'node:path'

const outDir = path.join(process.cwd(), 'out')
const sitemapPath = path.join(outDir, 'sitemap.xml')

if (!fs.existsSync(sitemapPath)) {
  console.error('mirror-trailing-slash: missing out/sitemap.xml; run next build first')
  process.exit(1)
}

const sitemap = fs.readFileSync(sitemapPath, 'utf8')
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(([, loc]) => new URL(loc).pathname)
  .filter((pathname) => pathname !== '/')

let mirrored = 0

for (const route of routes) {
  const source = path.join(outDir, `${route.replace(/^\//, '')}.html`)
  const target = path.join(outDir, route.replace(/^\//, ''), 'index.html')

  if (!fs.existsSync(source)) {
    console.error(`mirror-trailing-slash: expected ${path.relative(outDir, source)} for ${route}`)
    process.exit(1)
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  mirrored += 1
}

console.log(`mirror-trailing-slash: mirrored ${mirrored} route${mirrored === 1 ? '' : 's'}`)
