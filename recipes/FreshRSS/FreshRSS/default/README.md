# FreshRSS (default)

## What you get

- **Try locally**: A self‑hosted RSS reader UI on `http://localhost:8080`.
- Uses the official `freshrss/freshrss` image in a single-container setup.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8080` in your browser and follow the web installer:

- Choose language
- Create the first admin account
- Create the first RSS feed category and subscription

## Stop

```bash
docker compose down -v
```

This removes the containers and associated named volumes used for this local trial.

