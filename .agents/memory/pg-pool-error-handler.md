---
name: pg Pool error handler
description: pg.Pool must always have an error event listener; without one, any idle-connection drop crashes Node.js via an unhandled EventEmitter error.
---

# pg Pool: always add an error listener

**Rule:** Every `pg.Pool` instance must have a `.on("error", ...)` listener before the first connection is used.

**Why:** When an idle connection drops (transient network hiccup, DB restart, connection timeout), the pool emits an `"error"` event. Without a listener, Node.js's `EventEmitter` treats this as an uncaught error and **terminates the process immediately** — before any health check can respond. On autoscale, this manifests as a deployment promote-phase failure even though the build succeeded and the code is otherwise correct. The failure is intermittent (depends on whether a DB blip happens during the ~2s startup window), making it hard to reproduce.

**How to apply:** In `lib/db/src/index.ts`, immediately after `new Pool(...)`:

```typescript
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => {
  console.error("pg pool error (idle client):", err.message);
});
```

Do NOT add a `.once()` listener — use `.on()` so it covers all future idle-connection errors throughout the process lifetime.
