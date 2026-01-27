# photoprism (default)

## What you get

- **Try locally**: A photo management UI at `http://localhost:2342`.
- **SQLite + local volumes**: Stores data and originals in Docker volumes for quick tests.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:2342` in your browser and log in with the admin
password configured in `compose.yaml` (default: `photoprism`).

## Stop

```bash
docker compose down -v
```

