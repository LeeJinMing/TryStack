# seafile (default)

## What you get

- **Try locally**: A self-hosted file sync and collaboration UI at `http://localhost:8084`.
- **All-in-one image**: Uses the `seafileltd/seafile-mc` image with internal services.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8084` in your browser and follow the installer to
create an admin account.

## Stop

```bash
docker compose down -v
```

