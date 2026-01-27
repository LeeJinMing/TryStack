# grafana (default)

## What you get

- **Try locally**: A Grafana dashboard UI at `http://localhost:3002`.
- **Local storage**: Uses a Docker volume for Grafana data (dashboards, users, etc.).

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:3002` in your browser and log in with the default
admin credentials documented in the upstream Grafana README.

## Stop

```bash
docker compose down -v
```

