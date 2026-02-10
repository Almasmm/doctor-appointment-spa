import { access, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

async function resetMockDb() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(scriptDir, '..')
  const seedPath = path.join(projectRoot, 'mock', 'db.seed.json')
  const dbPath = path.join(projectRoot, 'mock', 'db.json')

  await access(seedPath)
  await copyFile(seedPath, dbPath)
  console.log('[db:reset] mock/db.json restored from mock/db.seed.json')
}

resetMockDb().catch((error) => {
  console.error('[db:reset] failed to restore mock database')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

