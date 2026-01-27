# Portainer (default)

## What you get

- **Try locally**: Portainer Community Edition UI to manage your local Docker engine.
- UI is exposed on `https://localhost:9443` using Portainer's self‑signed certificate.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `https://localhost:9443` in your browser and:

- Accept the self‑signed certificate warning
- Create the initial admin user
- Connect to the local Docker environment when prompted

## Stop

```bash
docker compose down -v
```

This stops Portainer and removes the named volume that stores its data for this local trial.

