# openclaw (default)

## What you get

- **Try locally (A2)**: OpenClaw Gateway UI at `http://localhost:18789`.
- **Important**: The gateway can start, but **core assistant capability requires provider auth** (Anthropic/OpenAI, etc.).

## Run

In this directory:

```bash
docker compose up -d openclaw-gateway
```

Then open `http://localhost:18789`.

This recipe sets a local token in `compose.yaml`:

- **OPENCLAW_GATEWAY_TOKEN**: `openclaw-local-token-change-me`

Change it before using outside localhost.

## Onboarding (recommended)

OpenClaw’s onboarding is interactive. Run:

```bash
docker compose run --rm openclaw-cli onboard --no-install-daemon
```

Follow the prompts (gateway bind: `lan`, auth: `token`).

## Stop

```bash
docker compose down -v
```

