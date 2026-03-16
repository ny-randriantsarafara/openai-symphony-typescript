# Running Symphony Locally

This is the practical local setup for the current repository state.

## What Works Now

- the backend CLI now starts the HTTP and WebSocket server
- the backend exposes `/api/v1/*` and `/ws`
- the dashboard dev server now proxies `/api/v1/*` and `/ws` from `:3001` to the backend on `:8080`

## Prerequisites

1. Install Node.js 20+.
2. Install pnpm 9+.
3. Export a valid Linear API key in your shell.

## Step 1: Install dependencies

```bash
pnpm install
```

## Step 2: Copy the example workflow

```bash
cp WORKFLOW.example.md WORKFLOW.md
```

Then edit `WORKFLOW.md` and set:
- `project_slug` to your Linear `slugId`
- any hooks you actually want
- the agent command you actually have installed

## Step 3: Export your environment variables

```bash
export LINEAR_API_KEY=lin_api_xxx
```

If you add clone hooks, also export whatever they need, for example `REPO_URL`.

## Step 4: Start the backend

```bash
pnpm --filter @symphony/server start ./WORKFLOW.md --port 8080
```

Useful smoke checks:

```bash
curl http://127.0.0.1:8080/api/v1/state
curl http://127.0.0.1:8080/api/v1/config
```

## Step 5: Start the dashboard

In a second terminal:

```bash
pnpm --filter @symphony/dashboard dev
```

Open:

```text
http://127.0.0.1:3001
```

The dashboard keeps same-origin browser requests and the local proxy forwards:
- `/api/v1/*` -> `http://127.0.0.1:8080`
- `/ws` -> `http://127.0.0.1:8080`

## Common Gotchas

1. `.env` is not loaded automatically by the backend config resolver; export variables in the shell where you start Symphony.
2. `project_slug` must be the Linear `slugId`, not the display name.
3. if the backend starts but no issues appear, verify your Linear key and project slug first.

## Quick Linear Checks

Verify the key:

```bash
curl https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ viewer { id name } }"}'
```

Find project slugs:

```bash
curl https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ projects(first: 20) { nodes { name slugId } } }"}'
```
