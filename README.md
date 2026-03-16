# Symphony

A long-running orchestration service that polls an issue tracker (Linear), creates isolated workspaces per issue, and runs coding agent sessions. Built with TypeScript + Node.js, featuring a real-time Mantine dashboard.

For the fastest local setup path, see `RUNNING.md`.

## What Symphony Does

**Symphony is an autonomous coding agent orchestrator.** It automates the workflow of:

```
Linear Issue → Isolated Workspace → Coding Agent → Pull Request
```

### The Flow

1. **Polls Linear** for issues in `Todo` or `In Progress` states
2. **Creates isolated workspace** per issue (clones your repo)
3. **Spawns a coding agent** (Codex, Claude, etc.) with issue context
4. **Agent works autonomously** to implement the feature/fix
5. **Monitors progress** with retries, timeouts, and rate limits
6. **Dashboard shows real-time status** of all sessions

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
- pnpm 9+ (`npm install -g pnpm`)
- A Linear API key

### Installation

```bash
git clone <repo-url>
cd symphony
pnpm install
pnpm build
```

### Configuration

1. Set your Linear API key:
   ```bash
   export LINEAR_API_KEY=your_key_here
   ```

2. Copy `WORKFLOW.example.md` to `WORKFLOW.md` in the repo root and edit it for your project

### Run Commands

| Purpose | Command |
|---------|---------|
| **Dev mode (all packages)** | `pnpm dev` |
| **Start orchestrator** | `pnpm --filter @symphony/server start` |
| **Start with custom workflow** | `pnpm --filter @symphony/server start ./WORKFLOW.md` |
| **Start with HTTP server** | `pnpm --filter @symphony/server start ./WORKFLOW.md --port 8080` |
| **Dashboard only** | `pnpm --filter @symphony/dashboard dev` |
| **Run tests** | `pnpm test` |
| **Type check** | `pnpm typecheck` |

## How to Use It

### 1. Configure Your Workflow (`WORKFLOW.md`)

```yaml
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: my-project      # Your Linear project
  active_states:
    - Todo                       # Issues in these states get picked up
    - In Progress

workspace:
  root: ~/symphony_workspaces    # Where workspaces are created

hooks:
  after_create: |
    git clone $REPO_URL .        # Clone your repo into workspace
  before_run: |
    git pull                     # Ensure latest code

agent:
  provider: codex                # or: claude, copilot
  max_concurrent_agents: 5       # Run 5 issues in parallel
```

The bottom section of WORKFLOW.md is a **Liquid template** that becomes the agent's prompt, injected with issue data (`{{ issue.title }}`, `{{ issue.description }}`, etc.).

### 2. Start Symphony

```bash
# Terminal 1: Start the orchestrator + API server
export LINEAR_API_KEY=lin_api_xxx
pnpm --filter @symphony/server start -- --port 8080

# Terminal 2: Start the dashboard
pnpm --filter @symphony/dashboard dev
```

### 3. Create Issues in Linear

Just create issues in your Linear project. Symphony will:
- Detect new issues in `Todo`/`In Progress` states
- Create a workspace at `~/symphony_workspaces/<issue-id>/`
- Run your `after_create` hook (clone repo)
- Spawn the coding agent with the templated prompt
- Monitor until completion or failure

### 4. Monitor via Dashboard

Open **http://localhost:3001**:

| Page | What You See |
|------|--------------|
| **Dashboard** | Active sessions, success rates, token usage |
| **Sessions** | Kanban board: Running → Retrying → Completed/Failed |
| **Analytics** | Charts for throughput, rate limits, costs |
| **Config** | Current WORKFLOW.md settings |

### 5. API Access

```bash
# Get all session states
curl http://localhost:8080/api/v1/state

# Trigger immediate poll (don't wait 30s)
curl -X POST http://localhost:8080/api/v1/refresh

# Get specific issue details
curl http://localhost:8080/api/v1/PROJ-123
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Session** | One agent working on one issue |
| **Workspace** | Isolated directory per issue (fresh git clone) |
| **Hooks** | Shell scripts run at lifecycle points (`after_create`, `before_run`) |
| **Retry** | Failed sessions auto-retry with exponential backoff |
| **Hot Reload** | Edit `WORKFLOW.md` → changes apply without restart |

## Example Use Case

> "I have 10 bug tickets in Linear. I want coding agents to work on them in parallel while I sleep."

1. Mark issues as `Todo` in Linear
2. Start Symphony
3. Watch dashboard as agents pick up issues
4. Wake up to PRs ready for review

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/state` | GET | Full runtime snapshot |
| `/api/v1/:identifier` | GET | Issue-specific debug details |
| `/api/v1/refresh` | POST | Trigger immediate poll cycle |
| `/api/v1/config` | GET | Current effective config |
| `/api/v1/events` | GET | Recent event history |
| `/ws` | WebSocket | Real-time event stream |

## Dashboard Pages

- **Dashboard**: Overview with stats cards, active sessions, activity feed, token usage chart
- **Sessions**: Kanban-style board with Running/Retrying/Completed/Failed columns
- **Analytics**: Token usage, success rates, throughput charts, rate limit status
- **Config**: Read-only configuration viewer with validation status

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

## License

MIT
