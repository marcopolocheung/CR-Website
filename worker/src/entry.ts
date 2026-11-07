// The deployed module exposes only the Worker handler. index.ts also exports
// constants and helpers for tests; workerd treats extra exports as RPC services.
export { default } from './index'
