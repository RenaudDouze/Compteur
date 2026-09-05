// Calcule, pour un lot (SHARD, 1-indexé) du job de mutation testing en CI,
// la sous-liste de stryker.config.json's `mutate` à passer à
// `stryker run --mutate`. Lire la liste depuis stryker.config.json (plutôt
// que la dupliquer dans le workflow) évite qu'un module ajouté à ce tableau
// échappe silencieusement aux deux lots.
import { readFileSync, appendFileSync } from 'node:fs'

const shardCount = 2
const shard = Number(process.env.SHARD)

const config = JSON.parse(readFileSync('stryker.config.json', 'utf8'))
const files = config.mutate.filter((_, i) => i % shardCount === shard - 1)

appendFileSync(process.env.GITHUB_OUTPUT, `files=${files.join(',')}\n`)
