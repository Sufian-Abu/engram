---
title: Designing a Rate Limiter
date: 2026-06-20
project: engram
provider: claude
topics: [rate limiter, Express API, Redis, sliding-window algorithm]
source_id: sample-claude-001
---

# Designing a Rate Limiter

Discussed designing a rate limiter for an Express API, choosing a sliding-window algorithm with Redis, and handling potential race conditions. Decided to use a Lua script for atomic counter updates and set a limit of 100 requests per minute per API key. Open issue: handling unauthenticated routes and clients behind shared NAT.

## Key facts

- Redis is used for rate limiting
- Sliding-window algorithm is used

## Decisions

- Use sliding-window algorithm with Redis
- Use Lua script to avoid race conditions
- Set limit of 100 requests per minute per API key

## Open questions / next steps

- How to handle unauthenticated routes
- How to handle clients behind shared NAT

## Resume prompt

_Paste this into any model to pick up where you left off:_

```text
Designing a rate limiter for an Express API: we chose a sliding-window algorithm with Redis, using a Lua script to avoid race conditions, and set a limit of 100 requests per minute per API key. We still need to decide how to handle unauthenticated routes and clients behind shared NAT. What are the next steps?
```
