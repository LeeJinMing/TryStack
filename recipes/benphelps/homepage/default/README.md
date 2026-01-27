# homepage (default)

## What you get

- **Try locally**: A self‑hosted dashboard UI for your services, running on `http://localhost:3000`.
- **No external keys required** for the basic UI; you only need Docker + Docker Compose.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:3000` in your browser.

homepage stores its configuration under `/app/config`. For this quick recipe we
mount a named Docker volume so you can restart the stack without losing settings.

For customizing dashboards and widgets, refer to the upstream README:
https://github.com/benphelps/homepage

## Stop

```bash
docker compose down -v
```

