# n8n (default)

## What you get

- **Try locally**: An automation/workflow UI at `http://localhost:5678`.
- **Single container**: Uses the official `n8nio/n8n` image with a local data volume.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:5678` in your browser.

## Stop

```bash
docker compose down -v
```

