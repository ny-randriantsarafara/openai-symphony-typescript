# Symphony — Full-Stack Implementation Design

Status: Approved
Date: 2026-03-13
Spec: https://github.com/openai/symphony/blob/main/SPEC.md

## Overview

Symphony is a long-running service that polls an issue tracker (Linear), creates isolated workspaces per issue, and runs coding agent sessions against those workspaces. This design covers a TypeScript + Node.js implementation with a Mantine-based dashboard, built as a Turborepo monorepo.

## Decisions

- **Runtime**: TypeScript + Node.js
- **Monorepo**: Turborepo with pnpm workspaces
- **Architecture**: Layered backend with embedded HTTP/WS server (single process)
- **Frontend**: Next.js + Mantine v7, DashVista-inspired aesthetic
- **Agent integration**: Provider-agnostic (Codex, Claude, Copilot, generic CLI)
- **Deployment**: Local CLI daemon

## Project Structure

```
symphony/
├── turbo.json
├── package.json
├── tsconfig.base.json
├── packages/
│   ├── core/                      # Pure orchestration logic
│   │   ├── src/
│   │   │   ├── domain/            # Value types (Issue, Workspace, RunAttempt, etc.)
│   │   │   ├── config/            # Workflow loader, config layer, validation
│   │   │   ├── orchestrator/      # Poll loop, state machine, dispatch, reconciliation
│   │   │   ├── tracker/           # Linear client adapter
│   │   │   ├── workspace/         # Workspace manager, hooks, path safety
│   │   │   ├── agent/             # Agent runner + provider abstraction
│   │   │   │   ├── types.ts       # AgentProvider, AgentSession, AgentEvent interfaces
│   │   │   │   ├── provider-registry.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── codex.ts
│   │   │   │   │   ├── claude.ts
│   │   │   │   │   ├── copilot.ts
│   │   │   │   │   └── generic-cli.ts
│   │   │   │   └── runner.ts
│   │   │   ├── prompt/            # LiquidJS template rendering
│   │   │   └── logging/           # Structured logger abstraction
│   │   └── package.json
│   ├── server/                    # HTTP/WS server + CLI entry point
│   │   ├── src/
│   │   │   ├── cli.ts             # CLI arg parsing (commander)
│   │   │   ├── http/              # Fastify routes (/api/v1/*)
│   │   │   ├── ws/                # WebSocket event broadcasting
│   │   │   └── static/            # Serves built frontend in production
│   │   └── package.json
│   ├── dashboard/                 # Next.js + Mantine frontend
│   │   ├── src/
│   │   │   ├── app/               # Next.js App Router pages
│   │   │   ├── components/        # Mantine UI components
│   │   │   ├── hooks/             # React hooks (useWebSocket, useApi)
│   │   │   ├── stores/            # Zustand stores
│   │   │   └── theme/             # Mantine theme config
│   │   └── package.json
│   └── shared/                    # Shared TypeScript types
│       ├── src/
│       │   ├── api.ts             # REST API request/response types
│       │   ├── events.ts          # WebSocket event types
│       │   └── domain.ts          # Shared domain types
│       └── package.json
├── docs/plans/
└── WORKFLOW.md                    # Example workflow file
```

Key principle: `packages/core` has zero framework dependencies — pure TypeScript with Node.js stdlib only.

## Backend Core (packages/core)

### Domain Model

Direct mapping from SPEC Section 4. All types are immutable value objects.

- **Issue** — normalized tracker record (id, identifier, title, description, priority, state, labels, blocked_by, timestamps)
- **WorkflowDefinition** — `{ config, promptTemplate }`
- **ServiceConfig** — typed getters over parsed front matter
- **Workspace** — `{ path, workspaceKey, createdNow }`
- **RunAttempt** — one execution attempt for one issue
- **LiveSession** — agent session metadata (sessionId, threadId, turnId, token counters, turn count)
- **RetryEntry** — `{ issueId, identifier, attempt, dueAtMs, error }`
- **OrchestratorState** — single authoritative in-memory state

### Config Layer

- `WorkflowLoader`: reads WORKFLOW.md, splits YAML front matter from prompt body (`yaml` npm)
- `ConfigResolver`: defaults, `$VAR` env indirection, `~` expansion, type coercion
- `ConfigValidator`: dispatch preflight checks
- File watching via `chokidar` for dynamic reload; invalid reloads keep last-known-good config

### Orchestrator

Single class owning mutable `OrchestratorState` with an event emitter for observability:

- `tick()` — reconcile, validate, fetch candidates, sort, dispatch. Scheduled via `setInterval`.
- `dispatch(issue, attempt)` — claim, spawn async worker task, track in running map.
- `reconcile()` — stall detection + tracker state refresh.
- `onWorkerExit(issueId, reason)` — continuation retry (1s) or exponential backoff.
- `onRetryTimer(issueId)` — re-fetch candidates, re-dispatch or release.
- `getSnapshot()` — runtime snapshot for API/dashboard.

Workers run as async tasks in the same process with concurrency limiting via a task pool.

### Tracker Client (Linear)

- `LinearClient` using native `fetch` for GraphQL
- Operations: `fetchCandidateIssues()`, `fetchIssueStatesByIds()`, `fetchIssuesByStates()`
- Pagination: cursor-based, page size 50
- Normalization: labels lowercased, blockers from inverse `blocks` relations, ISO-8601 timestamps

### Workspace Manager

- Path: `<workspace.root>/<sanitized_identifier>` (replace `[^A-Za-z0-9._-]` with `_`)
- Safety: absolute path validation, root containment check
- Hooks via `execFile` with `['bash', '-lc', script]` and `timeout_ms` (no shell injection risk)
- Lifecycle: `after_create`, `before_run`, `after_run`, `before_remove`

### Agent Provider Abstraction

Provider-agnostic agent integration via interfaces:

```typescript
interface AgentProvider {
  readonly name: string;
  startSession(params: SessionStartParams): Promise<AgentSession>;
}

interface AgentSession {
  readonly sessionId: string;
  runTurn(params: TurnParams): AsyncIterable<AgentEvent>;
  stop(): Promise<void>;
}
```

Providers: `CodexProvider` (JSON-RPC over stdio), `ClaudeProvider`, `CopilotProvider`, `GenericCliProvider`.

WORKFLOW.md front matter selects the provider:

```yaml
agent:
  provider: codex
  command: codex app-server
```

Provider-specific config lives under namespaced keys (e.g., `codex.approval_policy`).

### Prompt Rendering

- `LiquidJS` with strict mode (unknown variables/filters fail)
- Input: `{ issue, attempt }`

## Server and API (packages/server)

### CLI

- `commander` for arg parsing
- Usage: `symphony [path-to-WORKFLOW.md] [--port <port>]`
- Default workflow path: `./WORKFLOW.md`
- `--port` overrides `server.port` from front matter
- Graceful shutdown on SIGINT/SIGTERM

### HTTP Server (Fastify)

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/state` | GET | Full runtime snapshot |
| `/api/v1/:issueIdentifier` | GET | Issue-specific debug details |
| `/api/v1/refresh` | POST | Trigger immediate poll + reconciliation (202) |
| `/api/v1/config` | GET | Current effective config (sanitized) |
| `/api/v1/events` | GET | Recent event history (paginated) |

In production: serves built Next.js `out/` from `/`.

### WebSocket Server

Fastify WebSocket plugin on `/ws`. Subscribes to orchestrator `EventBus` and broadcasts:

| Event | Payload |
|---|---|
| `state:updated` | Snapshot delta |
| `session:started` | Issue ID, session ID, workspace path |
| `session:event` | Agent event details |
| `session:ended` | Issue ID, reason, duration, token totals |
| `retry:scheduled` | Issue ID, attempt, due time, error |
| `retry:fired` | Issue ID, attempt |
| `config:reloaded` | Config summary |
| `error` | Validation/tracker/workspace errors |

Full state snapshot on connect, incremental events after.

## Dashboard Frontend (packages/dashboard)

### Tech Stack

- Next.js (App Router) + Mantine v7
- Zustand for client state
- WebSocket hook for real-time updates
- React Query for REST API calls
- `@mantine/charts` (Recharts wrapper)

### Theme

DashVista-inspired:
- Rounded cards (`radius: md`), subtle gradients on stat cards, soft shadows
- Inter or system font stack
- Dark mode: deep blues/purples. Light mode: clean whites/grays
- Status colors: green (running/success), amber (retrying), red (failed), blue (info)
- Dark/light toggle in sidebar

### Pages

**Dashboard (`/`)** — Main overview:
- Stats cards: running, retrying, completed, total tokens
- Active sessions table (sortable, clickable to issue detail)
- Activity feed (real-time, color-coded by event type)
- Token usage area chart

**Issue Detail (`/issues/:identifier`)** — Deep dive:
- Header with state badge, priority, Linear link
- Session panel: session ID, turn count, last event, live tokens
- Workspace panel: path, creation date, hooks status
- Recent events timeline
- Retry history with timestamps and errors

**Sessions Board (`/sessions`)** — Kanban-style:
- Columns: Running, Retrying, Completed, Failed
- Cards: identifier, title, state badge, turn count, token summary

**Analytics (`/analytics`)** — Charts:
- Token usage over time (1h/6h/24h selectors)
- Success/failure rate donut chart
- Throughput bar chart (issues/hour)
- Rate limit status indicator

**Config (`/config`)** — Read-only:
- Current WORKFLOW.md path and last reload timestamp
- Parsed config as structured tree
- Active/terminal states as colored badges
- Validation status + reload button

### State Management

- Zustand stores for real-time orchestrator state
- WebSocket auto-reconnect with full snapshot on reconnect
- React Query for paginated/filtered REST data

### Operational Controls

- Refresh button (triggers `POST /api/v1/refresh`)
- Connection status indicator (green/red dot)
- Last poll timestamp in footer

## Error Handling

Discriminated union types for all errors (no thrown exceptions for expected failures):

```typescript
type SymphonyError =
  | { kind: 'missing_workflow_file'; path: string }
  | { kind: 'workflow_parse_error'; message: string }
  | { kind: 'template_render_error'; variable: string; message: string }
  | { kind: 'tracker_api_error'; status: number; message: string }
  | { kind: 'workspace_path_violation'; path: string; root: string }
  | { kind: 'agent_startup_failed'; provider: string; message: string }
  | { kind: 'agent_turn_timeout'; issueId: string; turnTimeoutMs: number }
  | { kind: 'agent_stalled'; issueId: string; stallTimeoutMs: number }
```

`Result<T, E>` wraps all fallible operations. Recovery behavior per SPEC:
- Config validation failures: skip dispatch, keep service alive
- Worker failures: exponential backoff retries
- Tracker failures: skip tick, retry next
- Dashboard failures: never crash orchestrator

## Logging

- `pino` for structured JSON logging
- Context fields: `issueId`, `issueIdentifier`, `sessionId`
- Secrets redacted at config layer
- Hook output truncated

## Testing

Following SPEC Section 17 validation matrix:

**Unit tests** (`vitest`): workflow parsing, config resolution, workspace sanitization, dispatch sorting, concurrency control, retry backoff, prompt rendering, provider contracts.

**Integration tests** (`vitest` + mocks): orchestrator tick lifecycle, reconciliation transitions, WebSocket broadcasting, config hot-reload, multi-turn agent sessions.

**E2E tests** (gated): real Linear API smoke test, full CLI startup/shutdown cycle.

**Frontend tests** (`vitest` + `@testing-library/react`): component rendering, WebSocket reconnection, theme toggle, Zustand stores.

## Key Dependencies

### Backend
- `yaml` — YAML parsing
- `liquidjs` — template rendering
- `chokidar` — file watching
- `pino` — structured logging
- `commander` — CLI arg parsing
- `fastify` — HTTP server
- `@fastify/websocket` — WebSocket support
- `vitest` — test runner

### Frontend
- `next` — React framework
- `@mantine/core`, `@mantine/hooks`, `@mantine/charts` — UI components
- `zustand` — state management
- `@tanstack/react-query` — API data fetching
- `recharts` — charts (via @mantine/charts)

### Monorepo
- `turbo` — build orchestration
- `typescript` — shared across all packages
