# nextcloud (default)

## What you get

- **Try locally**: A self-hosted file sync and collaboration platform at `http://localhost:8083`.
- **Local MariaDB**: Uses a bundled MariaDB container for data.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8083` in your browser and follow the installer to
create an admin account.

## Stop

```bash
docker compose down -v
```

