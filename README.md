# DecodeLabs Full Stack Development Tasks

**Muhammad Junaid** · Full Stack Development · 2026

Three self-contained coursework projects, organized in one repository as requested by the task submission form.

| Task | Project | Focus | Source |
|---|---|---|---|
| 1 | Atelier Form | Responsive HTML, CSS and JavaScript frontend | [Task 1](Task-1-Muhammad%20Junaid/) |
| 2 | Synapse API | REST endpoints, validation and CRUD | [Task 2](Task-2-Muhammad%20Junaid/) |
| 3 | Synapse Database | SQLite persistence, schema constraints and transactions | [Task 3](Task-3-Muhammad%20Junaid/) |

## Run

- Task 1: open `Task-1-Muhammad Junaid/index.html` or serve its folder with a static web server. Contact form validation is a frontend demonstration; it does not send email.
- Task 2: `cd "Task-2-Muhammad Junaid"`, then `npm start`. Open http://127.0.0.1:4300. Uses an in-memory store that resets at restart. Dashboard pulse and sample activity are illustrative.
- Task 3: `cd "Task-3-Muhammad Junaid"`, then `npm start`. Open http://127.0.0.1:4400. SQLite creates a local `data` directory on first start; saved records survive restarts.

Use Node.js 22.13 or newer for all backend projects. No npm dependency installation is required. Run `npm test` in each backend folder. Task 2 has four passing tests; Task 3 has three integration tests covering CRUD, persistence, validation, SQL injection handling, constraints and rollback.

Each project includes its own README. Task 1 and Task 2 include screenshots. Runtime databases and local test data are excluded.

## Submission links

- [Task 1](https://github.com/Junaidtheprogrammer/decodelabs_tasks/tree/main/Task-1-Muhammad%20Junaid)
- [Task 2](https://github.com/Junaidtheprogrammer/decodelabs_tasks/tree/main/Task-2-Muhammad%20Junaid)
- [Task 3](https://github.com/Junaidtheprogrammer/decodelabs_tasks/tree/main/Task-3-Muhammad%20Junaid)
