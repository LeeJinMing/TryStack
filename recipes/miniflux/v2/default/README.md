# miniflux (default)

## What you get

- **Try locally**: A minimal, fast RSS reader UI on `http://localhost:8081`.
- **Local Postgres only**: Uses an embedded Postgres container started by this compose file.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8081` in your browser.

This recipe creates an admin user with:

- **Username**: `admin`
- **Password**: `admin123`

for local evaluation only. Change these credentials after logging in.

## Stop

```bash
docker compose down -v
```

