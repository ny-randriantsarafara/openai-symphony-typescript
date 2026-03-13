# Symphony

A long-running orchestration service that polls an issue tracker (Linear), creates isolated workspaces per issue, and runs coding agent sessions. Built with TypeScript + Node.js, featuring a real-time Mantine dashboard.

## Features

- **Issue Tracking Integration**: Polls Linear for issues and dispatches coding agents
- **Provider-Agnostic Agents**: Supports Codex, Claude, GitHub Copilot, or any CLI agent
- **Real-Time Dashboard**: Beautiful Mantine v7 dashboard with live WebSocket updates
- **Workspace Isolation**: Per-issue workspaces with lifecycle hooks
- **Smart Retry Logic**: Exponential backoff with continuation retries
- **Hot Config Reload**: Edit WORKFLOW.md and changes apply without restart
- **Structured Observability**: Structured JSON logging with pino

## Architecture

Turborepo monorepo with four packages:

| Package | Description |
|---------|-------------|
| `@symphony/core` | Pure orchestration logic (zero framework deps) |
| `@symphony/server` | Fastify HTTP/WS server + CLI entry point |
| `@symphony/dashboard` | Next.js + Mantine v7 dashboard |
| `@symphony/shared` | Shared TypeScript types (API contracts) |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Linear API key

### Installation

```bash
git clone <repo-url>
cd symphony
pnpm install
pnpm build
```

### Configuration

1. Create a `WORKFLOW.md` in your working directory (see example in repo root)
2. Set your Linear API key:
   ```bash
   export LINEAR_API_KEY=your_key_here
   ```

### Running

```bash
# Start the orchestrator
pnpm --filter @symphony/server start

# With custom workflow path
pnpm --filter @symphony/server start -- path/to/WORKFLOW.md

# With HTTP server
pnpm --filter @symphony/server start -- --port 8080
```

### Dashboard

```bash
# Development mode (hot reload)
pnpm --filter @symphony/dashboard dev

# Access at http://localhost:3001
```

## Dashboard Pages

- **Dashboard**: Overview with stats cards, active sessions, activity feed, token usage chart
- **Sessions**: Kanban-style board with Running/Retrying/Completed/Failed columns
- **Analytics**: Token usage, success rates, throughput charts, rate limit status
- **Config**: Read-only configuration viewer with validation status

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/state` | GET | Full runtime snapshot |
| `/api/v1/:identifier` | GET | Issue-specific debug details |
| `/api/v1/refresh` | POST | Trigger immediate poll cycle |
| `/api/v1/config` | GET | Current effective config |
| `/api/v1/events` | GET | Recent event history |
| `/ws` | WebSocket | Real-time event stream |

## Development

```bash
# Run all tests
pnpm test

# Watch mode
pnpm --filter @symphony/core test:watch

# Type checking
pnpm typecheck

# Build all packages
pnpm build
```

## Configuration Reference

See WORKFLOW.md format documentation in the [SPEC](https://github.com/openai/symphony/blob/main/SPEC.md).

## License

MIT
