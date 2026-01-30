# seafile (default)

## What you get

- **Try locally**: A self-hosted file sync and collaboration UI at `http://localhost:8084`.
- **Local dependencies included**: Uses `seafileltd/seafile-mc` with a local MariaDB + Memcached.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8084` in your browser.

This recipe auto-creates an admin user for local evaluation:

- **Email**: `admin@example.invalid`
- **Password**: `admin12345`

## Stop

```bash
docker compose down -v
```

