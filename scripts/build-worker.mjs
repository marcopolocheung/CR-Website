import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Use the project's pinned Wrangler bundler; dashboard paste deployments need
// all shared validation code in one module with only the default handler export.
execFileSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run',
  '--config', 'worker/wrangler.toml', '--outdir', resolve('.wrangler/dashboard'),
], { stdio: 'inherit' })
writeFileSync('worker/dashboard.js', readFileSync('.wrangler/dashboard/entry.js', 'utf8').replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n'))
