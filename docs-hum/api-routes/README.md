# API Routes & Frontend Integration Docs

This folder contains per-step documentation for every API route and how to
call it from the frontend.

## How this folder works

Each step gets its own file named `step-N-routes.md` (e.g. `step-1-routes.md`).

Every file contains:
1. A **routes overview table** — every endpoint available at that step
2. **Request/Response examples** — exact JSON you send and receive
3. **Frontend code snippets** — copy-paste examples for React, Axios, vanilla JS
4. **CORS and error handling notes** — what to do when things go wrong

## Files

| File | What it covers |
|------|---------------|
| `step-1-routes.md` | Health check endpoint, basic frontend connection, CORS setup |
| (future) `step-2-routes.md` | Database schema routes, Supabase integration from frontend |
| (future) `step-3-routes.md` | Authentication routes (login, register, token handling) |

> Each new step will add its own file here.
