import { env } from './lib/env.js'
import { openDatabase, setDb } from './db/index.js'
import { createApp } from './app.js'
import { bootstrap } from './bootstrap.js'
import { purgeExpiredSessions } from './lib/session.js'

setDb(openDatabase())
await bootstrap()
const app = createApp()
app.listen(env.PORT, () => console.log(`StayBridge API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`))
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref()
