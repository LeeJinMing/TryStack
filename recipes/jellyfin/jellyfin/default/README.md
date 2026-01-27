# jellyfin (default)

## What you get

- **Try locally**: A self-hosted media server UI at `http://localhost:8096`.
- **Single container**: Uses the official `jellyfin/jellyfin` image with local config/cache volumes.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8096` in your browser and follow the wizard to add
media libraries and create an admin account.

## Stop

```bash
docker compose down -v
```

