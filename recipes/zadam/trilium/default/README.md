# trilium (default)

## What you get

- **Try locally**: A self-hosted note-taking and knowledge base at `http://localhost:8082`.
- **Single container**: Uses the official `zadam/trilium` image with a local data volume.

## Run

In this directory:

```bash
docker compose up -d
```

Then open `http://localhost:8082` in your browser and follow the UI to complete
the initial setup.

## Stop

```bash
docker compose down -v
```

