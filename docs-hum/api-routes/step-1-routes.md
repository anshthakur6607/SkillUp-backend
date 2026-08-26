# Step 1 — API Routes & Frontend Integration Guide

This document lists every API route available after Step 1 and shows exactly how
to call each one from a frontend (React, Next.js, plain HTML, etc.).

> **Base URL:** `http://localhost:5000` (default; change PORT in `.env` if needed)

---

## Routes Overview

| Method | Endpoint            | Auth Required? | Description                          |
|--------|---------------------|----------------|--------------------------------------|
| GET    | `/api/health`       | No             | Server health check — confirms everything is running |

> In future steps we will add more routes here (login, skills, courses, etc.)

---

## GET /api/health

### What it does
Returns a simple JSON message confirming the server, middleware chain, and
Supabase client are all initialized correctly. It does NOT query the database.

### Request

```
GET /api/health
```

No body, no headers required (except `Accept: application/json` is good practice).

### Response — Success (200)

```json
{
  "status": "ok",
  "timestamp": "2026-08-26T09:21:06.928Z"
}
```

| Field       | Type   | Meaning                                    |
|-------------|--------|--------------------------------------------|
| `status`    | string | `"ok"` means everything is healthy         |
| `timestamp` | string | ISO 8601 date/time when the check ran      |

### Response — Error (500)

```json
{
  "status": "error",
  "message": "An unexpected error occurred. Please try again later."
}
```

> In development mode, `message` includes more detail. In production, it is
> generic to avoid leaking internal information.

---

## How to Connect from the Frontend

### 1. Basic fetch (vanilla JavaScript)

```javascript
async function checkHealth() {
  const response = await fetch('http://localhost:5000/api/health');
  const data = await response.json();

  if (data.status === 'ok') {
    console.log('Server is running!', data.timestamp);
  } else {
    console.error('Server problem:', data.message);
  }
}

checkHealth();
```

### 2. React component

```jsx
import { useState, useEffect } from 'react';

function HealthStatus() {
  const [status, setStatus] = useState('checking...');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('http://localhost:5000/api/health');
        const data = await res.json();
        setStatus(data.status);
      } catch (err) {
        setError(err.message);
      }
    }
    fetchHealth();
  }, []);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  return <div>Server status: {status}</div>;
}

export default HealthStatus;
```

### 3. Axios (alternative to fetch)

```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:5000';

async function checkHealth() {
  try {
    const { data } = await axios.get(`${API_BASE}/api/health`);
    console.log('Server is healthy:', data);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}
```

### 4. React with environment variable for the base URL

Create a `.env` file in your **frontend** project:

```
REACT_APP_API_URL=http://localhost:5000
```

Then in your code:

```javascript
const API_URL = process.env.REACT_APP_API_URL;

const response = await fetch(`${API_URL}/api/health`);
```

> This way you can change the backend URL without editing code — just update
> the `.env` file for each environment (local, staging, production).

---

## CORS — Why You Might See Errors

If your frontend runs on a **different port** or **domain** than the backend,
the browser's CORS policy blocks the request unless the backend explicitly
allows your frontend's origin.

In our setup, CORS is configured via the `ALLOWED_ORIGINS` environment variable:

```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

- `http://localhost:3000` — typical Create React App / Next.js dev server
- `http://localhost:5173` — typical Vite dev server

**If you get a CORS error in the browser console**, add your frontend's
origin to `ALLOWED_ORIGINS` in the backend `.env` file and restart the server.

---

## Response Headers (set by Helmet)

Every response includes these security headers:

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 0
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: no-referrer
```

These are set automatically by Helmet. You don't need to do anything on the
frontend, but they protect users from common browser-based attacks.

---

## Rate Limiting — What to Expect

Each IP address is allowed **100 requests per 15 minutes** by default.

When the limit is exceeded, the server returns:

```json
{
  "status": "error",
  "message": "Too many requests. Please wait a moment and try again."
}
```

Response headers include rate limit info:

```
RateLimit-Limit: 100
RateLimit-Remaining: 91
RateLimit-Reset: 504
```

On the frontend, if you get this response, show the user a message like
"Please wait a moment and try again" rather than retrying immediately.

---

## What's Coming in Future Steps

| Step | Expected New Routes                          |
|------|----------------------------------------------|
| 2    | Database tables + Supabase migrations        |
| 3    | Authentication (login, register, logout)     |
| 4    | Skills/competency CRUD endpoints             |
| 5    | Learning path and course endpoints           |
| 6    | Assessment and evaluation endpoints          |

Each step will add its own row to this document with request/response examples.
