# searxng (default)

## What you get

- **Try locally**: A self-hosted metasearch engine at `http://localhost:8086`.
- **Single container**: Uses the official `searxng/searxng` image with local config/cache volumes.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8086` in your browser.

## Stop

```bash
docker compose down -v
```

