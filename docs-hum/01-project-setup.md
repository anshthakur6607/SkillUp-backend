# Step 1: Project Setup & Secure Backend Skeleton

## What was set up in this step and why

In this first step, we created the **foundation** for our backend server. Think of this like building the frame and security system of a house before moving in any furniture.

We set up:
- A **Node.js + Express server** — the basic web server that will receive requests from the frontend and return data
- **Supabase client** — ready-made database connections we'll use later to store and retrieve data
- **Security middleware** — a set of protective layers that filter and check every request before it reaches our code
- A **health check endpoint** — a simple "ping" to confirm the server is running correctly

This step is intentionally small. We're not building any business features yet — just making sure the server starts, responds to requests, and is protected from common attacks.

---

## What each folder and file does

### `backend/` — All server code lives here

| Path | What it does |
|------|-------------|
| `package.json` | Lists the project name, dependencies (libraries we use), and scripts (commands to run). Like a shopping list + instruction manual for the project. |
| `tsconfig.json` | Configures TypeScript — tells the compiler how to check our code for errors (strict mode is on, meaning it catches more potential bugs). |
| `.env.example` | A template showing what environment variables the project needs. You copy this to `.env` and fill in your real values. |
| `.gitignore` | Tells Git which files to ignore (never commit). Includes `node_modules/`, `.env`, and `dist/`. |
| `.env` | **Your real secrets live here.** Never commit this file to Git. It's in `.gitignore` to prevent accidents. |

### `backend/src/` — The actual source code

| Path | What it does |
|------|-------------|
| `config/env.ts` | Loads your `.env` file and validates all environment variables exist and have correct values. If any required variable is missing, the server **crashes immediately** with a clear error message — this is called "failing fast" and prevents the server from running in an insecure/incomplete state. |
| `config/supabaseClient.ts` | Creates two connections to your Supabase database: one "normal" client that respects Row Level Security (RLS), and one "service role" client that bypasses RLS for trusted server operations. |
| `middleware/rateLimiter.ts` | Limits how many requests each IP address can make (e.g., 100 per 15 minutes). |
| `middleware/sanitize.ts` | Cleans all incoming string data by removing potentially malicious HTML/script tags. |
| `middleware/errorHandler.ts` | Catches all errors from anywhere in the app and returns a safe, consistent error message — never leaking internal details in production. |
| `routes/health.ts` | Defines the `GET /api/health` route and connects it to its handler. |
| `controllers/healthController.ts` | Contains the actual code that runs when someone hits the health check endpoint. Returns `{ status: "ok", timestamp: "..." }`. |
| `types/database.ts` | Placeholder for database type definitions (will be filled in later when we create tables). |
| `types/responses.ts` | Defines the shape of our API responses (e.g., what fields the health check response has). |
| `utils/logger.ts` | Helper functions for logging messages in a consistent format. |
| `app.ts` | **The main wiring file.** Connects all middleware and routes in the correct order. This is where you see the full security chain in action. |
| `server.ts` | **The entry point.** This file loads environment variables and starts the server listening on a port. |

### `docs-hum/` — Human-readable documentation

This folder contains plain-English explanations of what each step built and why. It's for anyone on the team who wants to understand the system without reading code.

---

## Security protections added and what they protect against

### 1. Helmet — Secure HTTP Headers
**What it does:** Adds special security headers to every response the server sends.

**What it protects against:**
- **Clickjacking**: Attackers embedding your site in invisible iframes to trick users into clicking things they didn't mean to click
- **MIME sniffing**: Browsers guessing (wrongly) what type of file a response is, which could let an attacker trick the browser into running a file as a script
- **Some XSS attacks**: Content Security Policy headers tell the browser which scripts are allowed to run

### 2. CORS — Cross-Origin Resource Sharing
**What it does:** Controls which websites are allowed to make requests to this API.

**What it protects against:**
Without CORS, the browser blocks cross-origin requests by default. We explicitly list which origins (domains) are allowed. We do NOT use a wildcard (`*`) because that would let ANY website make requests to your API — if your API uses cookies or tokens for authentication, a malicious website could make authenticated requests on behalf of your users.

### 3. Rate Limiting
**What it does:** Limits each IP address to 100 requests per 15 minutes (configurable).

**What it protects against:**
- **Brute force attacks**: Someone trying thousands of password guesses per second
- **Denial of Service (DoS)**: Someone flooding the server with requests to make it unavailable for real users
- **API abuse**: Automated scripts hammering expensive operations

Think of it like a bouncer: "You can come in 100 times in 15 minutes. After that, wait outside for a while."

### 4. Input Sanitization (XSS Protection)
**What it does:** Scans all incoming text (request bodies, query parameters, URL parameters) and strips out HTML tags and JavaScript code.

**What it protects against:**
- **Reflected XSS**: An attacker puts malicious JavaScript in a form field or URL parameter, and it gets "reflected" back in the server's response
- **Stored XSS**: The malicious code gets saved in the database and later served to other users (more dangerous because it persists)

### 5. HTTP Parameter Pollution (HPP) Protection
**What it does:** Prevents attackers from sending the same query parameter multiple times with different values.

**What it protects against:**
If someone sends `?role=admin&role=user`, the server might receive an array `["admin", "user"]` instead of a single value. This could bypass security checks that expect a single string.

### 6. Body Size Limits
**What it does:** Limits the maximum size of JSON request bodies to 10 kilobytes.

**What it protects against:**
- **Payload DoS attacks**: Sending enormous request bodies (megabytes or gigabytes) to exhaust server memory and crash it

### 7. Centralized Error Handler
**What it does:** Catches all errors and returns a safe, consistent error response.

**What it protects against:**
- **Information leakage**: In production, error responses never include stack traces, file paths, database errors, or internal details that could help an attacker understand your system. These details are logged server-side only.
- In development mode, error messages are more detailed to help with debugging.

---

## How to run the project locally (step by step)

### Prerequisites
- [Node.js](https://nodejs.org/) installed (version 18 or higher)
- A terminal/command prompt

### First-time setup

1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```

2. Install all dependencies (this downloads the libraries we need):
   ```bash
   npm install
   ```

3. Create your local environment file by copying the template:
   ```bash
   cp .env.example .env
   ```
   (On Windows: `copy .env.example .env`)

4. Edit `.env` and fill in your Supabase values:
   - Get `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase dashboard (Settings → API)

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open another terminal and test the health check:
   ```bash
   curl http://localhost:5000/api/health
   ```
   You should see: `{"status":"ok","timestamp":"2026-..."}`

### Available commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts the server in development mode with automati
