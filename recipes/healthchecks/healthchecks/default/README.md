# healthchecks (default)

## What you get

- **Try locally**: A cron/heartbeat monitoring UI at `http://localhost:8000`.
- **SQLite only**: Uses an embedded SQLite database and dummy email settings for local tests.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8000` in your browser.

## Stop

```bash
docker compose down -v
```

