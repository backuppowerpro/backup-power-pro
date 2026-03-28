import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { runMigrations } from './migrate.js'
import { seedJurisdictions } from './seed.js'
import { runAutoArchive } from './archive.js'
import peopleRouter from './routes/people.js'
import jurisdictionsRouter from './routes/jurisdictions.js'
import eventsRouter from './routes/events.js'
import webhookRouter from './routes/webhook.js'
import analyticsRouter from './routes/analytics.js'

const app = express()
const PORT = process.env.PORT || 3001

runMigrations()
seedJurisdictions()

// Auto-archive on startup
runAutoArchive()

// Auto-archive every 60 minutes
setInterval(runAutoArchive, 60 * 60 * 1000)

// Middleware — order matters
app.use(helmet())
app.use(morgan('dev'))
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true }))

// API routes
app.use('/api/people', peopleRouter)
app.use('/api/jurisdictions', jurisdictionsRouter)
app.use('/api/events', eventsRouter)
app.use('/api/webhook', webhookRouter)
app.use('/api/analytics', analyticsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handler — must be last middleware
app.use((err, req, res, next) => {
  console.error(err.message)
  res.status(err.status || 500).json({ error: err.message })
})

app.listen(PORT, () => console.log(`[SERVER] http://localhost:${PORT}`))
