# Taskify

A full-stack task manager: create, view, update, complete, and delete daily tasks.

## Stack
- **Backend:** Node.js (built-in `http` module, no dependencies)
- **Database:** JSON file storage (`db/tasks.json`) — swap for SQLite/Postgres later if needed
- **Frontend:** Vanilla HTML/CSS/JS, served as static files

## Running it

Requires Node.js (v18+).

```bash
node server.js
```

Then open **http://localhost:8080** in your browser.

To use a different port:

```bash
PORT=4000 node server.js
```

## Features
- Add tasks with title (required), notes, due date, and priority
- Edit any task via the pencil icon
- Mark complete/incomplete with the checkbox
- Delete with a confirmation prompt
- Filter by All / Pending / Done
- Overdue tasks are highlighted
- Server-side + client-side validation (title required, valid date, valid priority/status)

## API
| Method | Endpoint          | Description           |
|--------|-------------------|------------------------|
| GET    | `/api/tasks`      | List all tasks         |
| POST   | `/api/tasks`      | Create a task          |
| PUT    | `/api/tasks/:id`  | Update a task          |
| DELETE | `/api/tasks/:id`  | Delete a task          |

### Task fields
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "dueDate": "YYYY-MM-DD or null",
  "priority": "low | medium | high",
  "status": "pending | completed"
}
```

## Project structure
```
taskify/
├── server.js          # HTTP server + REST API + validation
├── db/
│   └── tasks.json      # Task data store
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```
