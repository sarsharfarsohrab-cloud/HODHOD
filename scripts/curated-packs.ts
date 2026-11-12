/**
 * Writes the hand-written packs (content/packs/curated) as
 *   content/packs/curated.json        the packs as the test mode and the tests read them
 *   supabase/seed/curated-packs.sql   one SQL file that puts them into the database (unpublished)
 *
 *   bun run scripts/curated-packs.ts          write both files
 *   bun run scripts/curated-packs.ts --check  only check, write nothing
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildCurated, seedSql } from '../content/packs/curated/build.ts'

const packs = buildCurated()
for (const p of packs) console.log(`${p.slug}: ${p.items.length} cards in ${p.lesson_titles.length} groups`)
if (!process.argv.includes('--check')) {
  const root = new URL('..', import.meta.url).pathname
  writeFileSync(`${root}content/packs/curated.json`, `${JSON.stringify(packs, null, 1)}\n`)
  mkdirSync(`${root}supabase/seed`, { recursive: true })
  writeFileSync(`${root}supabase/seed/curated-packs.sql`, seedSql(packs))
  console.log('written: content/packs/curated.json, supabase/seed/curated-packs.sql')
}
