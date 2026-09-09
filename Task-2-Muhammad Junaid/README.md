# Synapse API

Synapse is a dependency-free Node.js REST API and responsive operations dashboard for managing workflow signals. It was built for Full Stack Development Project 2.

## Start

Requires Node.js 18 or newer.

```bash
npm start
```

Open `http://127.0.0.1:4300` in a browser.

## Test

```bash
npm test
```

## API routes

| Method | Route | Success | Description |
| --- | --- | --- | --- |
| GET | `/api` | 200 | API route map |
| GET | `/api/health` | 200 | Service health and uptime |
| GET | `/api/stats` | 200 | Workflow summary |
| GET | `/api/tasks` | 200 | List and filter tasks |
| GET | `/api/tasks/:id` | 200 | Retrieve one task |
| POST | `/api/tasks` | 201 | Create a validated task |
| PUT | `/api/tasks/:id` | 200 | Replace a task |
| PATCH | `/api/tasks/:id` | 200 | Partially update a task |
| DELETE | `/api/tasks/:id` | 204 | Delete a task |

List filters: `status`, `priority`, and `search`.

## Example request

```json
{
  "title": "Review response schema",
  "owner": "Muhammad Junaid",
  "priority": "high",
  "category": "API",
  "status": "queued"
}
```

## Engineering details

- Semantic REST resource naming and standard HTTP status codes
- JSON request and response contracts
- Field-level input validation and consistent error envelopes
- Request correlation IDs and rate-limit headers
- 32 KB body limit, local-origin CORS, and security headers
- Static dashboard served by the same backend
- Zero runtime dependencies
- Automated tests for health, listing, validation, and CRUD behavior

Data is held in memory for this training project and resets when the server restarts.
