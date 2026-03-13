---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: my-project
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
  after_create: |
    git clone $REPO_URL .
  before_run: |
    git fetch origin main
    git checkout main
    git pull
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

# Issue: {{ issue.identifier }} — {{ issue.title }}

You are an expert software engineer working on issue **{{ issue.identifier }}**.

## Issue Details

- **Title:** {{ issue.title }}
- **State:** {{ issue.state }}
- **Priority:** {{ issue.priority }}
- **URL:** {{ issue.url }}

{% if issue.description %}
## Description

{{ issue.description }}
{% endif %}

{% if issue.labels.size > 0 %}
## Labels

{% for label in issue.labels %}- {{ label }}
{% endfor %}
{% endif %}

{% if attempt %}
## Retry Information

This is retry attempt **{{ attempt }}**. Review what was accomplished in previous attempts and continue from where you left off. Do not repeat work that was already completed successfully.
{% endif %}

## Instructions

1. Read the issue description carefully
2. Understand the codebase context
3. Implement the required changes
4. Write tests for your changes
5. Ensure all existing tests pass
6. Create a pull request with a clear description

When you are done, move the issue to "Human Review" state.
