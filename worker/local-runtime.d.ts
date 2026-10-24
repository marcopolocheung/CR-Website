// Scoped runtime names for generated local-env.d.ts. Do not merge Workers'
// Request/Response globals into the frontend's DOM/Node test environment.
declare namespace Cloudflare {
  type KVNamespace = import('@cloudflare/workers-types').KVNamespace
  type R2Bucket = import('@cloudflare/workers-types').R2Bucket
  type D1Database = import('@cloudflare/workers-types').D1Database
}
