# Symphony Full-Stack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript + Node.js implementation of the Symphony orchestration service with a Mantine v7 dashboard, supporting provider-agnostic coding agent integration.

**Architecture:** Turborepo monorepo with four packages: `core` (pure orchestration logic, zero framework deps), `server` (Fastify HTTP/WS + CLI), `dashboard` (Next.js + Mantine), and `shared` (API contract types). The orchestrator runs as a single process with async worker tasks, embedded HTTP/WebSocket server, and file-watch-based config hot-reload.

**Tech Stack:** TypeScript, Node.js, Turborepo, pnpm, Fastify, Next.js, Mantine v7, Zustand, React Query, LiquidJS, pino, vitest

---

## Phase 1: Project Scaffolding & Shared Types

### Task 1: Initialize Turborepo Monorepo

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`

**Step 1: Create root package.json**

```json
{
  "name": "symphony",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  }
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.turbo/
.next/
out/
*.tsbuildinfo
.env
.env.local
```

**Step 5: Create .npmrc**

```
auto-install-peers=true
```

**Step 6: Create packages/shared/package.json**

```json
{
  "name": "@symphony/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "echo 'no tests yet'"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 7: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 8: Create packages/core/package.json**

```json
{
  "name": "@symphony/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@symphony/shared": "workspace:*",
    "chokidar": "^4",
    "liquidjs": "^10",
    "pino": "^9",
    "yaml": "^2"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 9: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 10: Create packages/server/package.json**

```json
{
  "name": "@symphony/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/cli.js",
  "bin": {
    "symphony": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/cli.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@symphony/core": "workspace:*",
    "@symphony/shared": "workspace:*",
    "commander": "^13",
    "fastify": "^5",
    "@fastify/websocket": "^11",
    "@fastify/static": "^8"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 11: Create packages/server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [
    { "path": "../core" },
    { "path": "../shared" }
  ]
}
```

**Step 12: Create packages/dashboard/package.json**

```json
{
  "name": "@symphony/dashboard",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev --port 3001",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  },
  "dependencies": {
    "@symphony/shared": "workspace:*",
    "@mantine/core": "^7",
    "@mantine/hooks": "^7",
    "@mantine/charts": "^7",
    "@tabler/icons-react": "^3",
    "@tanstack/react-query": "^5",
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "recharts": "^2",
    "zustand": "^5"
  },
  "devDependencies": {
    "@testing-library/react": "^16",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 13: Create packages/dashboard/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 14: Run pnpm install**

Run: `pnpm install`
Expected: All dependencies installed, lockfile created.

**Step 15: Verify turbo works**

Run: `pnpm turbo typecheck`
Expected: No errors (packages have no source files yet, but config is valid).

**Step 16: Commit**

```bash
git add -A
git commit -m "chore: scaffold Turborepo monorepo with four packages"
```

---

### Task 2: Define Shared Domain Types

**Files:**
- Create: `packages/shared/src/domain.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Write the shared domain types**

Create `packages/shared/src/domain.ts` with all domain model types from SPEC Section 4:

- `Issue` — normalized issue record
- `BlockerRef` — blocker reference
- `WorkflowDefinition` — parsed WORKFLOW.md payload
- `WorkspaceInfo` — workspace path + key + createdNow flag
- `RunAttemptStatus` — discriminated union of attempt phases
- `LiveSession` — agent session metadata
- `RetryEntry` — retry queue entry
- `OrchestratorSnapshot` — snapshot for API/dashboard consumption
- `AgentEvent` — discriminated union of agent events
- `SymphonyError` — discriminated union of all error kinds

Follow strict TypeScript: no `any`, readonly properties, discriminated unions.

**Step 2: Create the barrel export**

Create `packages/shared/src/index.ts` that re-exports everything from `domain.ts`.

**Step 3: Build shared package**

Run: `pnpm --filter @symphony/shared build`
Expected: Compiles to `packages/shared/dist/`.

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add domain model types from SPEC Section 4"
```

---

### Task 3: Define Shared API Contract Types

**Files:**
- Create: `packages/shared/src/api.ts`
- Create: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write REST API types in api.ts**

Define request/response types for each endpoint:

- `StateResponse` — GET /api/v1/state
- `IssueDetailResponse` — GET /api/v1/:issueIdentifier
- `RefreshResponse` — POST /api/v1/refresh (202)
- `ConfigResponse` — GET /api/v1/config
- `EventsResponse` — GET /api/v1/events
- `ApiError` — `{ error: { code: string; message: string } }`

**Step 2: Write WebSocket event types in events.ts**

Define discriminated union of WebSocket messages:

- `StateUpdatedEvent`
- `SessionStartedEvent`
- `SessionEventEvent`
- `SessionEndedEvent`
- `RetryScheduledEvent`
- `RetryFiredEvent`
- `ConfigReloadedEvent`
- `ErrorEvent`
- `WsMessage` — discriminated union of all above

**Step 3: Update index.ts barrel export**

Add re-exports for `api.ts` and `events.ts`.

**Step 4: Build and verify**

Run: `pnpm --filter @symphony/shared build`
Expected: Compiles cleanly.

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add REST API and WebSocket event contract types"
```

---

## Phase 2: Core Backend — Config & Workflow

### Task 4: Workflow Loader (YAML Front Matter + Prompt Body)

**Files:**
- Create: `packages/core/src/config/workflow-loader.ts`
- Test: `packages/core/src/config/__tests__/workflow-loader.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.1):
- Parses valid WORKFLOW.md with front matter + prompt body
- Returns empty config when no front matter present
- Returns typed error for missing file
- Returns typed error for invalid YAML
- Returns typed error for non-map YAML (e.g., a list)
- Trims prompt body whitespace
- Handles empty prompt body

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @symphony/core test -- src/config/__tests__/workflow-loader.test.ts`
Expected: All tests FAIL.

**Step 3: Implement WorkflowLoader**

- Read file from disk using `fs/promises`
- Split on `---` delimiters
- Parse YAML with `yaml` package
- Validate front matter is a map/object
- Return `Result<WorkflowDefinition, SymphonyError>`

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @symphony/core test -- src/config/__tests__/workflow-loader.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement WorkflowLoader with YAML front matter parsing"
```

---

### Task 5: Config Resolver (Defaults, $VAR, ~ Expansion)

**Files:**
- Create: `packages/core/src/config/config-resolver.ts`
- Test: `packages/core/src/config/__tests__/config-resolver.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.1):
- Applies defaults when optional values missing
- Resolves `$VAR_NAME` to environment variable values
- Treats empty `$VAR` resolution as missing
- Expands `~` in path values to home directory
- Preserves codex.command as shell string (no path expansion)
- Coerces string integers to numbers (polling.interval_ms)
- Normalizes per-state concurrency map keys to lowercase
- Ignores invalid per-state concurrency values (non-positive, non-numeric)

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @symphony/core test -- src/config/__tests__/config-resolver.test.ts`
Expected: All tests FAIL.

**Step 3: Implement ConfigResolver**

- Takes raw `WorkflowDefinition.config` map
- Returns typed `ServiceConfig` with all fields resolved
- Uses `os.homedir()` for `~` expansion
- Uses `process.env` for `$VAR` resolution
- Applies all defaults from SPEC Section 6.4

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @symphony/core test -- src/config/__tests__/config-resolver.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement ConfigResolver with defaults, env vars, path expansion"
```

---

### Task 6: Config Validator (Dispatch Preflight)

**Files:**
- Create: `packages/core/src/config/config-validator.ts`
- Test: `packages/core/src/config/__tests__/config-validator.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 6.3):
- Valid config passes validation
- Missing tracker.kind fails
- Unsupported tracker.kind fails
- Missing tracker.api_key (after $VAR resolution) fails
- Missing tracker.project_slug (when kind=linear) fails
- Missing/empty codex.command fails

**Step 2: Run tests, verify failure**

Run: `pnpm --filter @symphony/core test -- src/config/__tests__/config-validator.test.ts`
Expected: All FAIL.

**Step 3: Implement ConfigValidator**

- Takes `ServiceConfig`
- Returns `Result<void, SymphonyError>`
- Checks each dispatch-gating condition

**Step 4: Run tests, verify pass**

Run: `pnpm --filter @symphony/core test -- src/config/__tests__/config-validator.test.ts`
Expected: All PASS.

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement dispatch preflight config validation"
```

---

### Task 7: Config File Watcher (Dynamic Reload)

**Files:**
- Create: `packages/core/src/config/config-watcher.ts`
- Test: `packages/core/src/config/__tests__/config-watcher.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 6.2):
- Emits `changed` event when file changes
- Re-reads and re-parses on change
- Keeps last-known-good config on invalid reload
- Emits error event on invalid reload

**Step 2: Run tests, verify failure**

**Step 3: Implement ConfigWatcher**

- Uses `chokidar` to watch the workflow file
- On change: re-load via WorkflowLoader, re-resolve via ConfigResolver, re-validate
- Emits typed events: `configReloaded` (new config) or `configReloadFailed` (error)
- Exposes `getCurrentConfig()` getter

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement WORKFLOW.md file watcher with hot-reload"
```

---

## Phase 3: Core Backend — Tracker & Workspace

### Task 8: Linear Tracker Client

**Files:**
- Create: `packages/core/src/tracker/linear-client.ts`
- Create: `packages/core/src/tracker/linear-queries.ts`
- Test: `packages/core/src/tracker/__tests__/linear-client.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.3):
- `fetchCandidateIssues()` sends correct GraphQL query with project slug filter
- Normalizes issues (labels lowercase, blockers from inverse blocks relations, ISO timestamps)
- Handles pagination across multiple pages
- `fetchIssueStatesByIds()` uses `[ID!]` typing
- `fetchIssuesByStates()` returns empty without API call when given empty states array
- Maps API errors to typed SymphonyError variants (transport, non-200, GraphQL errors, malformed)

Use a mock fetch function — no real API calls.

**Step 2: Run tests, verify failure**

**Step 3: Implement LinearClient**

- Uses native `fetch` for GraphQL requests
- Authorization header from config
- Cursor-based pagination (page size 50)
- Issue normalization function
- Error categorization

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement Linear tracker client with pagination and normalization"
```

---

### Task 9: Workspace Manager

**Files:**
- Create: `packages/core/src/workspace/workspace-manager.ts`
- Create: `packages/core/src/workspace/path-safety.ts`
- Test: `packages/core/src/workspace/__tests__/workspace-manager.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.2):
- Produces deterministic workspace path per issue identifier
- Sanitizes identifier (replaces non `[A-Za-z0-9._-]` with `_`)
- Creates missing workspace directory
- Reuses existing workspace directory (createdNow = false)
- Rejects workspace path outside workspace root (path traversal)
- Validates workspace path is under root before returning
- Runs `after_create` hook only on new workspace
- Runs `before_run` hook; failure aborts attempt
- Runs `after_run` hook; failure is logged and ignored
- Runs `before_remove` hook; failure is logged and ignored
- Hook timeout is enforced

**Step 2: Run tests, verify failure**

**Step 3: Implement WorkspaceManager**

- `sanitizeIdentifier(identifier: string): string`
- `createForIssue(identifier: string): Promise<Result<WorkspaceInfo, SymphonyError>>`
- `removeWorkspace(identifier: string): Promise<void>`
- Hook execution via `execFile` with timeout
- Path safety: normalize to absolute, check prefix containment

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement workspace manager with path safety and hook lifecycle"
```

---

## Phase 4: Core Backend — Agent & Prompt

### Task 10: Agent Provider Interface & Registry

**Files:**
- Create: `packages/core/src/agent/types.ts`
- Create: `packages/core/src/agent/provider-registry.ts`
- Test: `packages/core/src/agent/__tests__/provider-registry.test.ts`

**Step 1: Write failing tests**

- Registry returns the registered provider by name
- Registry returns error for unknown provider name
- Default provider is "codex"

**Step 2: Run tests, verify failure**

**Step 3: Implement**

- Define `AgentProvider`, `AgentSession`, `AgentEvent`, `SessionStartParams`, `TurnParams` interfaces
- `ProviderRegistry` class with `register()` and `get()` methods

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add agent provider interface and registry"
```

---

### Task 11: Codex Agent Provider

**Files:**
- Create: `packages/core/src/agent/providers/codex.ts`
- Test: `packages/core/src/agent/__tests__/codex-provider.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.5):
- Launches command via bash with workspace cwd
- Sends initialize, initialized, thread/start, turn/start handshake in order
- Parses thread_id from thread/start response
- Parses turn_id from turn/start response
- Emits session_started event with composite session_id
- Enforces read_timeout_ms on startup handshake
- Enforces turn_timeout_ms during turn streaming
- Buffers partial JSON lines until newline
- Parses JSON from stdout only (stderr ignored for protocol)
- Non-JSON stderr lines do not crash parsing
- Auto-approves command/file-change approvals
- Rejects unsupported dynamic tool calls without stalling
- Fails on user-input-required
- Extracts token usage from nested payload shapes

Use a mock child process for all tests.

**Step 2: Run tests, verify failure**

**Step 3: Implement CodexProvider**

- Spawns child process with `execFile('bash', ['-lc', command], { cwd })`
- Readline on stdout for line-delimited JSON
- JSON-RPC message handling (request/response correlation)
- Event emission via AsyncIterable

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement Codex app-server provider with JSON-RPC protocol"
```

---

### Task 12: Agent Runner (Workspace + Prompt + Multi-Turn Loop)

**Files:**
- Create: `packages/core/src/agent/runner.ts`
- Test: `packages/core/src/agent/__tests__/runner.test.ts`

**Step 1: Write failing tests**

- Creates workspace, runs before_run hook, starts session, runs turn
- Multi-turn: after successful turn, re-checks issue state, continues on same thread
- Stops after max_turns
- Stops when issue state becomes non-active
- Runs after_run hook on success and failure
- Fails gracefully on workspace creation error
- Fails gracefully on before_run hook failure
- Fails gracefully on prompt rendering error

**Step 2: Run tests, verify failure**

**Step 3: Implement AgentRunner**

- Orchestrates workspace -> prompt -> session -> turn loop
- Emits events to parent (orchestrator callback)

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement agent runner with multi-turn loop"
```

---

### Task 13: Prompt Renderer (LiquidJS)

**Files:**
- Create: `packages/core/src/prompt/prompt-renderer.ts`
- Test: `packages/core/src/prompt/__tests__/prompt-renderer.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.1):
- Renders issue fields into template
- Renders attempt variable (null on first run, integer on retry)
- Renders nested arrays (labels, blockers)
- Fails on unknown variable (strict mode)
- Fails on unknown filter (strict mode)
- Handles empty template with fallback prompt

**Step 2: Run tests, verify failure**

**Step 3: Implement PromptRenderer**

- Uses `LiquidJS` with `strictVariables: true` and `strictFilters: true`
- Input: `{ issue, attempt }`
- Returns `Result<string, SymphonyError>`

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement strict prompt renderer with LiquidJS"
```

---

## Phase 5: Core Backend — Orchestrator

### Task 14: Orchestrator State & Dispatch Logic

**Files:**
- Create: `packages/core/src/orchestrator/state.ts`
- Create: `packages/core/src/orchestrator/dispatch.ts`
- Test: `packages/core/src/orchestrator/__tests__/dispatch.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.4):
- Dispatch sort: priority ascending (1..4 preferred, null last), then oldest created_at, then identifier
- Todo issue with non-terminal blockers is not dispatch-eligible
- Todo issue with terminal blockers is eligible
- Respects global concurrency limit (max_concurrent_agents)
- Respects per-state concurrency limits
- Issue already in running map is not eligible
- Issue already in claimed set is not eligible
- Candidate missing required fields (id, identifier, title, state) is not eligible

**Step 2: Run tests, verify failure**

**Step 3: Implement**

- `OrchestratorState` class with running map, claimed set, retry map, completed set, totals
- `sortForDispatch(issues)` — sort by priority -> created_at -> identifier
- `shouldDispatch(issue, state)` — eligibility checks
- `availableSlots(state)` — global and per-state slot calculation

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement orchestrator state, dispatch sorting, and eligibility"
```

---

### Task 15: Retry Queue & Backoff

**Files:**
- Create: `packages/core/src/orchestrator/retry.ts`
- Test: `packages/core/src/orchestrator/__tests__/retry.test.ts`

**Step 1: Write failing tests**

Test cases:
- Normal worker exit schedules continuation retry with 1000ms delay
- Abnormal exit schedules retry with 10000 * 2^(attempt-1) delay
- Backoff caps at max_retry_backoff_ms (default 300000)
- Scheduling a retry cancels any existing retry for the same issue
- Retry entry includes attempt, dueAtMs, identifier, error
- Retry handler: fetches candidates, dispatches if eligible and slots available
- Retry handler: releases claim if issue not found in candidates
- Retry handler: requeues with "no available orchestrator slots" error when full

**Step 2: Run tests, verify failure**

**Step 3: Implement RetryQueue**

- `scheduleRetry(issueId, attempt, opts)` — creates RetryEntry, sets timer
- `cancelRetry(issueId)` — clears timer and entry
- `onRetryFired(issueId)` — callback that re-checks eligibility
- Backoff math: `Math.min(10000 * Math.pow(2, attempt - 1), maxRetryBackoffMs)`

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement retry queue with exponential backoff"
```

---

### Task 16: Reconciliation (Stall Detection + State Refresh)

**Files:**
- Create: `packages/core/src/orchestrator/reconciliation.ts`
- Test: `packages/core/src/orchestrator/__tests__/reconciliation.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.4):
- Stall detection: kills worker when elapsed > stall_timeout_ms and schedules retry
- Stall detection: skipped when stall_timeout_ms <= 0
- Tracker state refresh: active state updates running entry
- Tracker state refresh: terminal state stops worker and cleans workspace
- Tracker state refresh: non-active/non-terminal state stops worker without cleanup
- Reconciliation with no running issues is a no-op
- Tracker state refresh failure: keeps workers running

**Step 2: Run tests, verify failure**

**Step 3: Implement Reconciliation**

- `reconcileStalls(state, config)` — detect and kill stalled sessions
- `reconcileTrackerStates(state, tracker, config)` — refresh + transition
- `reconcile(state, tracker, config)` — compose both parts

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement active run reconciliation with stall detection"
```

---

### Task 17: Orchestrator Main Loop

**Files:**
- Create: `packages/core/src/orchestrator/orchestrator.ts`
- Create: `packages/core/src/orchestrator/event-bus.ts`
- Test: `packages/core/src/orchestrator/__tests__/orchestrator.test.ts`

**Step 1: Write failing tests**

Test cases:
- tick() runs reconcile -> validate -> fetch -> sort -> dispatch in order
- Skips dispatch when validation fails but still reconciles
- Skips dispatch when candidate fetch fails
- Worker exit triggers retry scheduling
- getSnapshot() returns correct running/retry/totals/rate-limits
- Startup performs terminal workspace cleanup
- Poll interval is rescheduled on config change
- Concurrency limit is re-applied on config change

**Step 2: Run tests, verify failure**

**Step 3: Implement Orchestrator**

- Main class with `start()`, `stop()`, `tick()`, `getSnapshot()`
- EventBus (typed EventEmitter) for observability
- Composes all sub-modules: config watcher, tracker, workspace manager, agent runner, retry queue, reconciliation

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): implement orchestrator main loop with event bus"
```

---

### Task 18: Core Package Barrel Export

**Files:**
- Create: `packages/core/src/index.ts`

**Step 1: Create barrel export**

Export all public API from core: Orchestrator, ConfigWatcher, WorkflowLoader, ConfigResolver, ConfigValidator, LinearClient, WorkspaceManager, AgentRunner, ProviderRegistry, PromptRenderer, EventBus, and relevant types.

**Step 2: Build core**

Run: `pnpm --filter @symphony/core build`
Expected: Compiles cleanly.

**Step 3: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add barrel export for all public API"
```

---

## Phase 6: Server (CLI + HTTP + WebSocket)

### Task 19: CLI Entry Point

**Files:**
- Create: `packages/server/src/cli.ts`
- Test: `packages/server/src/__tests__/cli.test.ts`

**Step 1: Write failing tests**

Test cases (SPEC Section 17.7):
- Accepts optional positional workflow path argument
- Uses `./WORKFLOW.md` when no path provided
- Errors on nonexistent explicit workflow path
- Accepts `--port` flag
- Surfaces startup failure cleanly

**Step 2: Run tests, verify failure**

**Step 3: Implement CLI**

- Uses `commander` for arg parsing
- Resolves workflow path (explicit or default)
- Validates file exists before proceeding
- Creates orchestrator, starts HTTP server (if port configured), starts orchestrator
- Graceful shutdown on SIGINT/SIGTERM

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/server/
git commit -m "feat(server): implement CLI entry point with arg parsing and graceful shutdown"
```

---

### Task 20: Fastify HTTP Server & REST API

**Files:**
- Create: `packages/server/src/http/server.ts`
- Create: `packages/server/src/http/routes/state.ts`
- Create: `packages/server/src/http/routes/issue-detail.ts`
- Create: `packages/server/src/http/routes/refresh.ts`
- Create: `packages/server/src/http/routes/config.ts`
- Create: `packages/server/src/http/routes/events.ts`
- Test: `packages/server/src/__tests__/http.test.ts`

**Step 1: Write failing tests**

- GET /api/v1/state returns snapshot with running, retrying, codex_totals
- GET /api/v1/:issueIdentifier returns issue detail or 404
- POST /api/v1/refresh returns 202 with queued: true
- GET /api/v1/config returns sanitized config (no secrets)
- GET /api/v1/events returns paginated event list
- Unsupported methods return 405
- API errors use `{ error: { code, message } }` envelope

**Step 2: Run tests, verify failure**

**Step 3: Implement routes**

- Create Fastify instance with routes
- Each route handler calls orchestrator.getSnapshot() or related methods
- Secret redaction in config endpoint

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/server/
git commit -m "feat(server): implement REST API endpoints with Fastify"
```

---

### Task 21: WebSocket Server

**Files:**
- Create: `packages/server/src/ws/ws-server.ts`
- Test: `packages/server/src/__tests__/ws.test.ts`

**Step 1: Write failing tests**

- Client receives full state snapshot on connect
- Client receives incremental events after connect
- All event types from shared/events.ts are broadcast
- Multiple clients receive the same events
- Disconnected clients are cleaned up

**Step 2: Run tests, verify failure**

**Step 3: Implement WsServer**

- Registers `@fastify/websocket` plugin
- On connection: send full snapshot, subscribe to EventBus
- On EventBus event: serialize and broadcast to all clients
- On disconnect: unsubscribe

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/server/
git commit -m "feat(server): implement WebSocket server for real-time event broadcasting"
```

---

## Phase 7: Dashboard Frontend

### Task 22: Next.js + Mantine Setup & Theme

**Files:**
- Create: `packages/dashboard/src/app/layout.tsx`
- Create: `packages/dashboard/src/app/page.tsx`
- Create: `packages/dashboard/src/theme/theme.ts`
- Create: `packages/dashboard/src/theme/MantineProvider.tsx`
- Create: `packages/dashboard/next.config.ts`

**Step 1: Set up Next.js with Mantine**

- Configure Next.js App Router
- Set up Mantine v7 provider with custom theme
- DashVista-inspired theme: rounded cards, subtle gradients, Inter font, deep blue/purple dark mode, clean light mode
- Dark/light color scheme support

**Step 2: Create a minimal home page**

- Render "Symphony Dashboard" in Mantine typography
- Verify it builds: `pnpm --filter @symphony/dashboard build`

**Step 3: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): set up Next.js with Mantine v7 and DashVista-inspired theme"
```

---

### Task 23: Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `packages/dashboard/src/components/layout/AppShell.tsx`
- Create: `packages/dashboard/src/components/layout/Sidebar.tsx`
- Create: `packages/dashboard/src/components/layout/Header.tsx`
- Create: `packages/dashboard/src/components/layout/ConnectionStatus.tsx`
- Modify: `packages/dashboard/src/app/layout.tsx`

**Step 1: Implement AppShell layout**

- Mantine `AppShell` with collapsible sidebar and top header
- Sidebar: Symphony logo, navigation links (Dashboard, Sessions, Analytics, Config), theme toggle, connection status
- Header: page title, refresh button, last poll timestamp
- Responsive: sidebar collapses on mobile

**Step 2: Implement ConnectionStatus indicator**

- Green dot = WebSocket connected
- Red dot with "Reconnecting..." = disconnected

**Step 3: Verify**

Run: `pnpm --filter @symphony/dashboard dev`
Expected: Layout renders with sidebar and header.

**Step 4: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement AppShell layout with sidebar navigation"
```

---

### Task 24: State Management (Zustand + WebSocket Hook)

**Files:**
- Create: `packages/dashboard/src/stores/symphony-store.ts`
- Create: `packages/dashboard/src/hooks/use-websocket.ts`
- Create: `packages/dashboard/src/hooks/use-api.ts`
- Test: `packages/dashboard/src/__tests__/symphony-store.test.ts`

**Step 1: Write failing tests**

- Store initializes with empty state
- Store updates running sessions from state:updated event
- Store updates retry entries
- Store updates totals
- Store handles session:started, session:ended events
- Store handles full snapshot replacement on reconnect

**Step 2: Run tests, verify failure**

**Step 3: Implement Zustand store**

- `useSymphonyStore` — holds running sessions, retry entries, totals, events, config, connection status
- Actions: `setSnapshot`, `applyEvent`, `setConnectionStatus`

**Step 4: Implement useWebSocket hook**

- Connects to `ws://localhost:<port>/ws`
- Auto-reconnect with exponential backoff
- On connect: fetches full state via GET /api/v1/state, updates store
- On message: dispatches to store
- Updates connection status in store

**Step 5: Implement useApi hook**

- Wrapper around React Query for REST API calls
- `useStateQuery`, `useIssueDetail`, `useConfig`, `useEvents`
- `useRefreshMutation` for POST /api/v1/refresh

**Step 6: Run tests, verify pass**

**Step 7: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement Zustand store, WebSocket hook, and API hooks"
```

---

### Task 25: Dashboard Home Page

**Files:**
- Create: `packages/dashboard/src/components/dashboard/StatsCards.tsx`
- Create: `packages/dashboard/src/components/dashboard/ActiveSessionsTable.tsx`
- Create: `packages/dashboard/src/components/dashboard/ActivityFeed.tsx`
- Create: `packages/dashboard/src/components/dashboard/TokenUsageChart.tsx`
- Modify: `packages/dashboard/src/app/page.tsx`

**Step 1: Implement StatsCards**

- Four Mantine `Paper` cards in a grid:
  - Running (green accent, activity icon)
  - Retrying (amber accent, clock icon)
  - Completed (blue accent, check icon)
  - Total Tokens (purple accent, token icon)
- Subtle gradient backgrounds, large numbers, rounded corners
- Live-updating from Zustand store

**Step 2: Implement ActiveSessionsTable**

- Mantine `Table` showing running sessions
- Columns: Issue ID, State (badge), Turn Count, Tokens, Last Event, Duration
- Sortable by column headers
- Rows are clickable -> navigate to `/issues/:identifier`

**Step 3: Implement ActivityFeed**

- Vertical timeline of recent events (last 50)
- Each entry: timestamp, event type (color-coded badge), issue identifier, message
- Auto-scrolls on new events
- DashVista-style chat/activity panel aesthetic

**Step 4: Implement TokenUsageChart**

- `@mantine/charts` AreaChart showing token consumption over time
- Time range selector (1h, 6h, 24h)
- Input/output tokens as stacked areas

**Step 5: Compose home page**

- Grid layout: stats cards on top, sessions table in middle, activity feed + chart side by side at bottom
- All components pull from Zustand store (real-time)

**Step 6: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement home page with stats, sessions table, activity feed, and chart"
```

---

### Task 26: Issue Detail Page

**Files:**
- Create: `packages/dashboard/src/app/issues/[identifier]/page.tsx`
- Create: `packages/dashboard/src/components/issue/IssueHeader.tsx`
- Create: `packages/dashboard/src/components/issue/SessionPanel.tsx`
- Create: `packages/dashboard/src/components/issue/WorkspacePanel.tsx`
- Create: `packages/dashboard/src/components/issue/EventTimeline.tsx`
- Create: `packages/dashboard/src/components/issue/RetryHistory.tsx`

**Step 1: Implement IssueHeader**

- Issue identifier (large), title, state badge (colored), priority indicator, Linear URL link
- Breadcrumb: Dashboard > Issues > MT-649

**Step 2: Implement SessionPanel**

- Current session ID, turn count, last event type + timestamp, live token counter
- Mantine Paper with subtle border

**Step 3: Implement WorkspacePanel**

- Workspace path (monospace), creation status, hooks execution status
- Mantine Paper

**Step 4: Implement EventTimeline**

- Scrollable timeline of agent events for this specific issue
- Color-coded by event type, timestamps, messages

**Step 5: Implement RetryHistory**

- Table of past retry attempts: attempt number, timestamp, error message, duration

**Step 6: Compose issue detail page**

- Fetches data via `GET /api/v1/:identifier` (React Query)
- Live updates from WebSocket for the specific issue

**Step 7: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement issue detail page with session, workspace, events, and retries"
```

---

### Task 27: Sessions Board (Kanban)

**Files:**
- Create: `packages/dashboard/src/app/sessions/page.tsx`
- Create: `packages/dashboard/src/components/sessions/SessionBoard.tsx`
- Create: `packages/dashboard/src/components/sessions/SessionCard.tsx`

**Step 1: Implement SessionCard**

- Mantine Paper card: issue identifier, title (truncated), state badge, turn count, token summary
- Clickable -> issue detail page
- DashVista task card aesthetic

**Step 2: Implement SessionBoard**

- Four columns: Running, Retrying, Completed, Failed
- Each column is a scrollable container of SessionCards
- Column headers with count badges
- Responsive: stacks on mobile

**Step 3: Compose sessions page**

- Pulls from Zustand store (real-time)

**Step 4: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement kanban-style sessions board"
```

---

### Task 28: Analytics Page

**Files:**
- Create: `packages/dashboard/src/app/analytics/page.tsx`
- Create: `packages/dashboard/src/components/analytics/TokenChart.tsx`
- Create: `packages/dashboard/src/components/analytics/SuccessRateChart.tsx`
- Create: `packages/dashboard/src/components/analytics/ThroughputChart.tsx`
- Create: `packages/dashboard/src/components/analytics/RateLimitStatus.tsx`

**Step 1: Implement TokenChart**

- `@mantine/charts` AreaChart: input vs output tokens over time
- Time range selector (1h, 6h, 24h)

**Step 2: Implement SuccessRateChart**

- DonutChart: success vs failure vs timeout percentages

**Step 3: Implement ThroughputChart**

- BarChart: issues completed per hour

**Step 4: Implement RateLimitStatus**

- Status indicator showing current rate limit state
- Red/amber/green based on proximity to limits

**Step 5: Compose analytics page**

- 2x2 grid of charts

**Step 6: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement analytics page with token, success, throughput charts"
```

---

### Task 29: Config Page

**Files:**
- Create: `packages/dashboard/src/app/config/page.tsx`
- Create: `packages/dashboard/src/components/config/ConfigTree.tsx`
- Create: `packages/dashboard/src/components/config/ValidationStatus.tsx`

**Step 1: Implement ConfigTree**

- Tree view of current effective configuration
- Keys in monospace, values with type-appropriate formatting
- Active/terminal states as colored badges
- Secrets shown as "***" (already redacted by API)

**Step 2: Implement ValidationStatus**

- Green check if all validation passes
- Red X with error details if validation fails

**Step 3: Compose config page**

- WORKFLOW.md path and last reload timestamp at top
- Config tree in center
- Validation status
- "Trigger Refresh" button

**Step 4: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): implement config viewer page with tree view and validation status"
```

---

## Phase 8: Integration & Polish

### Task 30: Static Asset Serving in Production

**Files:**
- Modify: `packages/server/src/http/server.ts`
- Modify: `packages/dashboard/next.config.ts`

**Step 1: Configure Next.js static export**

- Set `output: 'export'` in next.config.ts
- Configure `basePath` if needed

**Step 2: Serve static assets from Fastify**

- Use `@fastify/static` to serve `packages/dashboard/out/` at `/`
- Fallback to `index.html` for client-side routing

**Step 3: Test production build**

Run: `pnpm build && pnpm --filter @symphony/server start -- --port 8080`
Expected: Dashboard loads at `http://localhost:8080`

**Step 4: Commit**

```bash
git add packages/
git commit -m "feat: serve dashboard as static assets from Fastify in production mode"
```

---

### Task 31: Example WORKFLOW.md

**Files:**
- Create: `WORKFLOW.md`

**Step 1: Write example workflow**

Create a WORKFLOW.md with example front matter covering all config sections and a sample prompt template.

**Step 2: Commit**

```bash
git add WORKFLOW.md
git commit -m "docs: add example WORKFLOW.md"
```

---

### Task 32: README

**Files:**
- Create: `README.md`

**Step 1: Write README**

- Project overview
- Quick start (prerequisites, install, configure, run)
- Architecture overview
- Configuration reference
- Dashboard features
- Development guide (how to run in dev mode)
- Testing guide

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README"
```

---

## Task Dependency Graph

```
Task 1 (scaffold) ──► Task 2 (domain types) ──► Task 3 (API types)
                                                      │
                    ┌─────────────────────────────────┘
                    ▼
          ┌── Task 4 (workflow loader)
          │   Task 5 (config resolver)
          │   Task 6 (config validator)
          │   Task 7 (config watcher)
          │
          ├── Task 8 (Linear client)
          │   Task 9 (workspace manager)
          │
          ├── Task 10 (agent interface)
          │   Task 11 (Codex provider)
          │   Task 12 (agent runner)
          │   Task 13 (prompt renderer)
          │
          ▼
    Task 14 (dispatch) ──► Task 15 (retry) ──► Task 16 (reconciliation) ──► Task 17 (orchestrator)
                                                                                    │
          ┌─────────────────────────────────────────────────────────────────────────┘
          ▼
    Task 18 (core export) ──► Task 19 (CLI) ──► Task 20 (HTTP) ──► Task 21 (WebSocket)
                                                                          │
          ┌───────────────────────────────────────────────────────────────┘
          ▼
    Task 22 (Mantine setup) ──► Task 23 (layout) ──► Task 24 (state mgmt)
          │
          ▼
    Task 25 (home) ─┐
    Task 26 (issue)  ├──► Task 30 (static serving) ──► Task 31 (WORKFLOW.md) ──► Task 32 (README)
    Task 27 (board)  │
    Task 28 (analytics)
    Task 29 (config) ┘
```

**Parallelizable groups after Task 3:**
- Tasks 4-7 (config) can run in parallel with Tasks 8-9 (tracker/workspace) and Tasks 10-13 (agent/prompt)
- Tasks 25-29 (dashboard pages) can run in parallel with each other
