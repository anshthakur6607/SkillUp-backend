# Step 2: Database Schema & Row Level Security

## What was built in this step

This step created the **entire database schema** for the Skill Intelligence & Learning Platform. Think of this as designing the filing system for a government office — we defined every type of record we'll store, how records relate to each other, and who is allowed to see or change each record.

The schema covers:
- **Identity & profile** — who the users are, which department they belong to
- **Competency framework** — what skills we're measuring and tracking
- **Surveys** — self-assessment questions that help establish baseline skill levels
- **Courses & learning** — available training content and user progress
- **Assessments** — tests that measure competency mastery
- **Certificates** — official records of course completion

We also implemented **Row Level Security (RLS)** on every table — this is the system that controls who can see and do what, directly in the database. It's the most important security layer in the entire application.

---

## How the tables relate to each other

Here's the big picture, described as a story:

1. **Every user has a profile** (`profiles`), linked to a department (`departments`). The profile stores their name, job role, education, and — most importantly — their **role** (employee, manager, or admin). This role determines what they can see throughout the system.

2. **Competencies are organized into domains** (`competency_domains` → `competencies`). There are four domains: Statistical, Technical, Digital Governance, and Behavioural & Managerial. Each domain contains individual skills like "Survey Design" or "Python Programming."

3. **Users have competency scores** (`user_competency_scores`). Each score represents how proficient a user is at a specific competency. This is what the dashboards and gap analysis read from.

4. **Surveys help establish scores.** Survey questions (`survey_questions`) are linked to competencies. When a user answers them, their responses (`survey_responses`) feed into their competency scores.

5. **Courses teach competencies.** Each course (`courses`) is linked to one or more competencies via `course_competencies`. Users enroll in courses (`enrollments`) and track their progress.

6. **Assessments test what courses taught.** Each assessment (`assessments`) is linked to a course. Questions (`assessment_questions`) are tagged with the competency they test and their difficulty level. When users take an assessment, their attempt (`assessment_attempts`) and individual answers (`assessment_answers`) are recorded.

7. **Certificates are issued on completion.** When a user finishes a course and passes the assessment, they receive a certificate (`certificates`) with a unique verification code.

**The relationship flow:**

```
departments ←── profiles ──→ user_competency_scores ←── competencies ←── competency_domains
                                    ↑
                              survey_responses ←── survey_questions
                                    ↑
                              enrollments ←── courses ──→ course_competencies ──→ competencies
                                    ↑                       ↑
                              certificates              assessments ←── assessment_questions
                                                            ↑
                                                      assessment_attempts ←── assessment_answers
```

---

## What each table is for

### Identity & Profile

| Table | What it's for |
|-------|--------------|
| **departments** | Lookup table of government department names (e.g. "Ministry of Statistics and Programme Implementation"). Prevents inconsistent naming across the system. |
| **profiles** | One row per user. Stores their name, job title, department, education, and role (employee/manager/admin). Linked to Supabase Auth — no passwords stored here. |

### Competency Framework

| Table | What it's for |
|-------|--------------|
| **competency_domains** | The four top-level skill categories: Statistical, Technical, Digital Governance, Behavioural & Managerial. |
| **competencies** | Individual skills grouped under a domain. Examples: "Survey Design", "Python", "Data Privacy", "Leadership". |
| **user_competency_scores** | Each user's current proficiency score (0-100) for each competency. This is the main table that dashboards and gap analysis read from. |

### Surveys

| Table | What it's for |
|-------|--------------|
| **survey_questions** | Self-assessment questions linked to competencies. Can be scoped to specific departments or job roles. |
| **survey_responses** | A user's answer to a survey question, with their self-assessed score. Append-only — once submitted, can't be changed. |

### Courses & Learning

| Table | What it's for |
|-------|--------------|
| **courses** | Course metadata. Tracks where the course comes from (iGOT, internal, or NSSTA TPAC), duration, and external references. |
| **course_competencies** | Which competencies each course teaches. Many-to-many: one course can cover multiple competencies, and one competency can be taught by multiple courses. |
| **enrollments** | A user's enrollment in a course, with progress percentage and status (not started / in progress / completed). |

### Assessments

| Table | What it's for |
|-------|--------------|
| **assessments** | Assessment definitions linked to courses. Each has a pass threshold (e.g. 60%) and optional time limit. |
| **assessment_questions** | Individual questions within an assessment. Tagged with the competency being tested and difficulty level (beginner → critical). |
| **assessment_attempts** | A user's attempt at an assessment: their score, whether they passed, and timestamps. **Insert-only** — users cannot modify or delete these. |
| **assessment_answers** | Each individual answer within an attempt. Records what the user selected and whether it was correct. **Insert-only** — the foundation for "where am I going wrong?" analysis. |

### Certificates

| Table | What it's for |
|-------|--------------|
| **certificates** | Official certificate of course completion. Has a unique verification code that can be checked publicly without an account. **Insert-only** — users cannot create fake certificates. |

---

## How Row Level Security (RLS) works

### What is RLS?

Row Level Security is a PostgreSQL feature that **automatically filters every query** based on who is making the request. Without RLS, anyone with the database connection string can read or write any row. With RLS, the database itself enforces the rules — even if the application code has a bug.

Think of it as a security guard stationed at every table. Before any data is returned or written, the guard checks: "Is this person allowed to see/change this specific row?"

### Why we use it

1. **Defense in depth** — even if our application code has a security hole, the database itself prevents unauthorized access
2. **The anon key is exposed** — Supabase's anonymous API key is visible in frontend code, so anyone could technically connect to the database. RLS ensures they can only see what they're allowed to see.
3. **Government data requires it** — for a project handling citizen and employee data in India's statistical system, database-level security isn't optional.

### The helper functions

We created three reusable SQL functions that our RLS policies call, rather than duplicating role-check logic in every policy:

| Function | What it does | Why it matters |
|----------|-------------|----------------|
| `is_admin()` | Returns true if the current user has the 'admin' role | Used by ~20 policies. If we had to repeat the role-check logic in each one, a typo in even one policy could create a security hole. With the function, we audit the logic once. |
| `is_manager_of(target_user_id)` | Returns true if the current user is a manager AND the target user is in the same department | Ensures managers can only see their own department's data — never other departments. |
| `set_updated_at()` | Automatically sets `updated_at` to the current time when
