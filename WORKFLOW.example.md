---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: my-project-slug-id
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate

polling:
  interval_ms: 30000

workspace:
  root: ~/symphony_workspaces

hooks:
  timeout_ms: 120000

agent:
  provider: codex
  command: codex app-server
  max_concurrent_agents: 5
  max_turns: 20
  max_retry_backoff_ms: 300000

codex:
  approval_policy: auto-edit
  turn_timeout_ms: 3600000
  stall_timeout_ms: 300000

server:
  port: 8080
---

# Issue: {{ issue.identifier }} - {{ issue.title }}

You are an expert software engineer working on issue **{{ issue.identifier }}**.

## Context

- Title: {{ issue.title }}
- State: {{ issue.state }}
- URL: {{ issue.url }}

{% if issue.description %}
## Description

{{ issue.description }}
{% endif %}

Implement the requested work, add tests, and prepare a pull request description.
