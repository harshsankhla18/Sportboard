# Sportboard

Sportboard is a Node.js backend for sports matches and live commentary. It provides a REST API to create and list matches and commentary, persists records in PostgreSQL, and uses WebSockets to push new events to clients subscribed to a match.

This repository contains the backend and a sample commentary seeder; it does not contain a browser frontend. A separate frontend needs to call this API and connect to its WebSocket endpoint.

## Features

- Create and list matches.
- Add and retrieve commentary for an individual match.
- Persist match and commentary data in PostgreSQL, with Neon’s serverless driver.
- Publish match-specific commentary to subscribed WebSocket clients and broadcast new-match events to all connected clients.
- Check WebSocket connection liveness with periodic ping/pong heartbeats.
- Load sample match/commentary data from `src/data/data.json` and seed it through the REST API.
- Validate request bodies, query parameters, and match IDs with Zod.
- Optional integration for Arcjet request protection.

## Architecture

```text
Browser / frontend
   | REST: GET/POST /matches...
   | WebSocket: /ws (subscribe to a match ID)
   v
Express app + HTTP server (src/index.js)
   |-- Match and commentary routers
   |      |-- Zod validation
   |      |-- Controllers
   |             |-- Drizzle ORM
   |             |-- Neon PostgreSQL
   |             |-- Broadcast after successful writes
   |
   `-- WebSocket server (src/ws/server.js)
          |-- In-memory pub/sub subscriptions, grouped by match ID
          `-- Ping/pong heartbeat and stale-connection cleanup

Seed script (src/seed/seed.js)
   `-- Reads src/data/data.json and calls the configured API_URL
```

### Request and broadcast flow

1. A client creates a match or posts commentary over HTTP.
2. The route passes the request to its controller. Zod validates incoming values before database work.
3. The controller writes the record using Drizzle and the Neon PostgreSQL connection.
4. After the write succeeds, the controller calls a broadcaster stored in `app.locals`.
5. The WebSocket layer sends a JSON event to all connected clients subscribed to that match. Match-created events are broadcast to all connected WebSocket clients.

The WebSocket layer implements a small in-process pub/sub system: clients subscribe to a match ID, and commentary events are published only to that match’s subscribers. Match-created events are published to all connected clients. The database is the persistent source of truth; WebSocket messages are notifications, not a replacement for fetching match/commentary history through REST.

## Project layout

```text
src/
  index.js                       Express app, HTTP server, WebSocket wiring
  arcjet.js                      Arcjet configuration and HTTP middleware
  controllers/
    matches.controllers.js       Match request handling and database operations
    commentary.controllers.js    Commentary request handling and database operations
  routes/
    matches.routes.js            /matches routes
    commentary.routes.js         Nested commentary routes
  db/
    db.js                        Environment loading and database connection
    schema.js                    Drizzle table and enum definitions
  validation/
    matches.js                   Match schemas and status constants
    commentary.js                Commentary schemas
  utils/
    api-response.js              Shared response envelope
    match-status.js              Match status calculation helpers
  ws/
    server.js                    WebSocket subscriptions and event broadcasts
  seed/
    seed.js                      REST-based sample data seeder
  data/
    data.json                    Sample matches and commentary

drizzle/                          SQL migration and Drizzle metadata
drizzle.config.js                 Drizzle Kit configuration
```

## Requirements and setup

- Node.js 20 or later is recommended (the project uses native `fetch`).
- npm.
- A PostgreSQL database. The current database module uses Neon’s serverless driver.

Install dependencies:

```sh
npm install
```

Create a local `.env` file. Never commit this file or put credentials in README, source code, or frontend bundles.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
PORT=8000
HOST=0.0.0.0

# The seeder writes to this backend. Use localhost for local development.
API_URL=http://localhost:8000

# Optional seeder controls
DELAY_MS=250
SEED_MATCH_DURATION_MINUTES=120
SEED_FORCE_LIVE=true

# Arcjet is still required by the current module guard, even though HTTP
# middleware is not mounted. See the Arcjet section before running without it.
ARCJET_KEY=<Arcjet key>
ARCJET_MODE=LIVE

```

`DATABASE_URL` must point to the database where you want the app to read and write. If local `.env` points to a production database, local API calls and seed runs will modify production data. Keep separate local and production database credentials.

Apply the checked-in database migrations:

```sh
npm run db:migrate
```

Start the development server:

```sh
npm start
```

The server listens on `HOST` and `PORT`; defaults are `0.0.0.0:8000`. For local use, open `http://localhost:8000/`. The root endpoint returns a small health-style greeting. `npm start` runs Node with `--watch`, so it restarts after source changes.

## REST API

All successful and error responses use the general envelope:

```json
{
  "statuscode": 200,
  "data": [],
  "message": "Success",
  "success": true
}
```

Validation errors return HTTP 400. Controllers currently return HTTP 500 for caught database/request-processing errors.

### `GET /matches?limit=50`

Returns the most recently created matches first. `limit` is optional, must be a positive integer, and is capped at 100 (default 50).

### `POST /matches`

Creates a match. `sport`, `homeTeam`, `awayTeam`, `startTime`, and `endTime` are required. Dates must be ISO date-time strings with an offset, and the end must be after the start. Scores are optional non-negative integers and default to zero.

```json
{
  "sport": "football",
  "homeTeam": "Home FC",
  "awayTeam": "Away FC",
  "startTime": "2026-10-23T10:00:00.000Z",
  "endTime": "2026-10-23T12:00:00.000Z",
  "homeScore": 0,
  "awayScore": 0
}
```

The initial status is computed at creation time: `scheduled`, `live`, or `finished`. There is currently no endpoint or background job that keeps a match’s status synchronized as time passes.

### `GET /matches/:id/commentary?limit=100`

Returns up to 100 commentary records for the match, newest `createdAt` first. The match ID must be a positive integer.

### `POST /matches/:id/commentary`

Adds commentary to the specified match. Required values are `minute`, `sequence`, `period`, `eventType`, and `message`. `minute` and `sequence` must be non-negative integers. Optional values include `actor`, `team`, `metadata` (a JSON object or `null`), and `tags` (an array of strings or `null`).

```json
{
  "minute": 23,
  "sequence": 4,
  "period": "1st half",
  "eventType": "goal",
  "actor": "Player Name",
  "team": "Home FC",
  "message": "A goal for the home side.",
  "metadata": { "assist": "Another Player" },
  "tags": ["goal"]
}
```

## WebSocket protocol

Connect to `ws://localhost:8000/ws` locally. Use `wss://<your-host>/ws` in production when the site is served over HTTPS.

The server sends a `welcome` message after connection. To receive updates for a match, send:

```json
{ "type": "subscribe", "matchId": 42 }
```

The server acknowledges with `subscribed`. To stop receiving updates:

```json
{ "type": "unsubscribe", "matchId": 42 }
```

New commentary is sent to subscribers as:

```json
{ "type": "commentary", "data": { "...": "commentary record" } }
```

New matches are broadcast to every connected WebSocket client as:

```json
{ "type": "match_created", "data": { "...": "match record" } }
```

The server sends WebSocket protocol ping frames periodically. A responsive client library automatically answers with pong frames; the server marks the connection alive on pong and terminates connections that fail to respond before the next liveness check. This is transport-level connection health checking, separate from the application JSON subscription messages.

Subscriptions are held in process memory. After a disconnect, the client should reconnect, subscribe again, and fetch REST history to recover events missed while offline. This pub/sub implementation works within one server process. In a multi-instance deployment, clients connected to different instances will not share subscriptions or broadcasts without a shared pub/sub broker such as Redis.

## Sample data seeder

Run:

```sh
npm run seed
```

The seeder reads `src/data/data.json` and calls `API_URL`; it does not insert directly into the database. Configure `API_URL=http://localhost:8000` to seed the local service. If it is set to a deployed URL, the seed data is posted to that deployed backend instead. Check both `API_URL` and `DATABASE_URL` before running it.

The script finds existing matches by sport and team names, can create matches from the data file, expands reusable commentary templates across matching sports, and posts commentary entries with a delay. By default, `SEED_FORCE_LIVE` is enabled and the script adjusts/creates matches so they are live when seeded. `DELAY_MS` controls the delay between commentary posts; `SEED_MATCH_DURATION_MINUTES` controls the default duration used for matches.

The seeder is intended for development/demo data. It creates persistent records and has no cleanup mode, so avoid running it against production unless that is deliberate.

## Database model

### `matches`

- `id`: serial primary key.
- `sport`, `home_team`, `away_team`: required text.
- `status`: PostgreSQL enum (`scheduled`, `live`, `finished`), default `scheduled`.
- `start_time`: required timestamp with time zone.
- `end_time`: nullable timestamp with time zone in the table (the create API currently requires it).
- `home_score`, `away_score`: non-negative by API validation, default zero.
- `created_at`: timestamp with time zone, default current time.

### `commentary`

- `id`: serial primary key.
- `match_id`: required foreign key to `matches.id`, with cascade deletion.
- `minute`, `sequence`: required integers.
- `period`, `event_type`, `message`: required text.
- `actor`, `team`: nullable text.
- `metadata`: nullable JSONB.
- `tags`: nullable text array.
- `created_at`: timestamp with time zone, default current time.

The migration is in `drizzle/`. Update the Drizzle schema first, then generate and review a migration before applying it:

```sh
npm run db:generate
npm run db:migrate
```

## Arcjet

Arcjet integration is present in `src/arcjet.js`. The HTTP middleware is currently **not mounted** in `src/index.js` (the `app.use(securityMiddleware())` line is commented out). However, the WebSocket upgrade handler still calls `wsArcjet.protect()` when the Arcjet client is configured. In addition, `src/arcjet.js` currently throws during module loading if `ARCJET_KEY` is missing, so the integration is not fully optional and the server may fail to start without a key—even with the HTTP middleware commented out. `ARCJET_MODE` controls the rules mode; check the variable name because the code does not read `ARCJET_ENV`. To disable Arcjet completely because the paid service is not being used, remove or gate the module-level requirement and WebSocket protection as well as leaving HTTP middleware unmounted. Do not add paid-service credentials to source control.

## Current limitations and improvement ideas

### Recommended next steps

1. **Separate local and production environments.** Keep different `DATABASE_URL` and `API_URL` values, and make the target environment obvious before running the seeder.
2. **Add automated tests.** `npm test` is currently a placeholder. Add unit tests for validation/status logic and integration tests for routes, persistence, and broadcasts using a test database.
3. **Complete Arcjet opt-out behavior.** Make the no-key case intentional and safe (the current module throws when `ARCJET_KEY` is missing despite nullable-client branches), and gate both HTTP and WebSocket protection consistently if Arcjet is optional.
4. **Add score/status operations.** The schema contains scores and status, but there are no active routes for score updates or ending a match. Status is only calculated on match creation.
5. **Improve query behavior.** Add cursor-based pagination and stable ordering (for example by `created_at` plus `id`); consider ordering commentary by match period/sequence rather than insertion time.
6. **Scale WebSocket delivery.** The current in-process pub/sub and ping/pong heartbeat cover single-instance event delivery and connection liveness. Use shared pub/sub (such as Redis) if running more than one server instance. Add authentication/authorization and an allowed-origin policy if the app is exposed publicly.
7. **Tighten reliability and observability.** Add structured logging, graceful shutdown, consistent central error handling, request limits, and health/readiness endpoints. Avoid returning raw database error messages to clients in production.
8. **Improve data integrity.** Consider database constraints/indexes for common access paths (such as commentary by match and creation time), uniqueness/idempotency rules for seed retries, and validation limits for text and metadata sizes.
9. **Clarify runtime/deployment configuration.** Provide a complete `.env.example` with names and safe placeholders, document deployment commands/health checks, and verify reverse-proxy WebSocket upgrade support.

## Available npm scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Run the API with Node watch mode. |
| `npm run seed` | Post sample match/commentary data to `API_URL`. |
| `npm run db:generate` | Generate Drizzle migrations from schema changes. |
| `npm run db:migrate` | Apply pending migrations. |
| `npm run db:crud` | Runs `src/crud.js`; that file is not currently present in the repository. |
| `npm test` | Placeholder that exits with an error; automated tests are not yet configured. |
