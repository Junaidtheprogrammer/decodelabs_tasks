# Synapse Database — Project 3

DecodeLabs Full Stack Development: Database Integration. This standalone extension of Project 2 connects the backend to a real SQLite database. The original Project 2 folder is unchanged.

## Run

Install Node.js 22.13+ (tested with 22.15.1). No npm packages or cloud credentials are needed.

```sh
npm start
```

Open http://127.0.0.1:4400. Create your first signal, edit it, filter the list, and delete it when no longer needed. Restart the server: records and activity history remain saved. Node 22 may print an experimental SQLite warning; this is expected.

```sh
npm test
```

Tests use separate temporary databases. They cover complete CRUD, reopening the database, retained deletions and history, invalid JSON and oversized bodies, SQL injection payloads, database constraints, and transaction rollback.

## Requirements and implementation

| Requirement | Implementation |
|---|---|
| Connect backend and database | `database.js`, native `node:sqlite` driver |
| Simple schema | `schema.sql`, tables for owners, tasks, activity and migrations |
| Create, read, update, delete | REST endpoints and dashboard controls |
| Proper data handling | Parameter binding, validation, constraints, atomic transactions |
| Permanent storage | `data/synapse.sqlite`, persisted across process restarts |

An owner has many tasks. `tasks.owner_id` references `owners.id`; names are unique ignoring case. Foreign key checks are enabled for every database connection. Required fields use NOT NULL and CHECK constraints. Indexes cover task owner and status. Activity stores a snapshot of the task ID and title deliberately without a foreign key, so deletion history survives. Each mutation and its activity entry commit together or roll back together. Schema version 1 is recorded without reseeding deleted records on restart.

## API

| Method | Path | Result |
|---|---|---|
| GET | `/api` | Route map |
| GET | `/api/health` | Live database connectivity |
| GET | `/api/stats` | Counts from saved records |
| GET | `/api/activity` | Latest 20 committed changes |
| GET | `/api/tasks?status=&priority=&search=` | Filtered signals |
| GET | `/api/tasks/:id` | One saved signal |
| POST | `/api/tasks` | Create, HTTP 201 |
| PUT | `/api/tasks/:id` | Replace editable fields |
| PATCH | `/api/tasks/:id` | Update supplied fields |
| DELETE | `/api/tasks/:id` | Delete, HTTP 204 |

Send `Content-Type: application/json` for POST/PUT/PATCH:

```json
{"title":"Review database schema","owner":"Muhammad Junaid","status":"queued","priority":"high","category":"Database"}
```

Title: 3–80 characters; owner: 2–50; category: 2–30. Status: queued, in-progress, completed. Priority: low, medium, high. POST/PUT require title and owner; defaults are queued, medium and General. PATCH retains unspecified fields. Unknown fields and empty objects are rejected. Search treats SQL wildcard characters as literal text.

## Storage and limits

`DB_PATH` overrides the default database file, and `PORT` overrides 4400. SQLite uses WAL mode and a 5-second busy timeout. The database starts empty; no demo data is silently inserted. To back up this local project, stop the server cleanly and copy the `data` directory. Runtime data is ignored by Git.

This coursework app binds to localhost and has no authentication. It is intended for a single local workspace. Add authentication, authorization, deployment configuration and backup operations before exposing it publicly. SQLite's synchronous driver is suitable for this small training application; larger workloads should reconsider concurrency and storage architecture.
