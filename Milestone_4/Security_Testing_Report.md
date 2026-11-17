# BookBack — Security Testing Report (Milestone 4)

## 1. Overview
BookBack handles student accounts, multi-role administration, private request conversations, and campus listings. Security testing was conducted across authentication, multi-role authorization (Super Admin, Team Admin, Student RBAC & IDOR), setup key protection, tamper-resistant audit logging, NoSQL injection, SQL injection string handling, Cross-Site Scripting (XSS), password storage, and HTTP security headers.

## 2. Security Controls Implemented
- **Password Hashing & Credential Protection**: `bcryptjs` with cost factor `12`. `passwordHash` is marked `select: false` on the Mongoose `User` schema and omitted from all API responses. Zero admin or demo passwords are hardcoded in frontend source files.
- **One-Time Setup Protection**: Initial `super_admin` and `team_admin` onboarding (`/api/setup/initialize`) verifies `ADMIN_SETUP_KEY` (or `./data/.setup_key`) using `crypto.timingSafeEqual` and permanently locks once a `super_admin` exists.
- **Multi-Role RBAC & Super Admin Safeguards**:
  - `requireSuperAdmin` strictly gates team management, platform security settings updates, backup/restore, permanent deletion, and audit record restoration to `role === 'super_admin'`.
  - `requirePermission(perm)` enforces granular permissions (`manage_books`, `manage_requests`, `investigate_discrepancies`, `verify_users`, `view_reports`) for `team_admin` accounts.
  - Team Admins cannot disable, modify, or view/alter the Main Owner (`super_admin`) account; attempts return `403 Forbidden` and automatically log an `unauthorized_modification` discrepancy.
- **Tamper-Resistant Activity Logs**: Every admin correction requires a mandatory `reason` (min 5 chars) and stores `previousValue` and `newValue`. HTTP `PUT/PATCH/DELETE /api/admin/audit-logs/:id` always returns `403 Forbidden`, and Mongoose pre-hooks reject deletion or alteration.
- **Human-Review Anomaly Detection**: Repeated failed logins, quantity jumps, duplicate listings, request bursts, and availability mismatches create `Discrepancy` records without ever automatically accusing or suspending a user.
- **NoSQL Injection & XSS Prevention**: `sanitizeRequestMiddleware` rejects `$` operator keys and dotted keys with `400 Bad Request`; `sanitizePlainText()` strips `<script>` tags, HTML tags, `javascript:` URIs, and inline `on*=` attributes.
- **Security Headers**: Configured via `helmet` (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Powered-By` removed).

## 3. Actual Security Test Cases & Observed Results (`tests/security.test.ts`, `tests/integration.test.ts`, `tests/admin_rbac.test.ts`)
Executed via `npm test` (`vitest run`).

| Test ID | Vulnerability Category | Attack Payload / Scenario | Expected Defense | Observed Result |
|---|---|---|---|---|
| SEC-01 | NoSQL Injection (Auth Bypass) | `POST /api/auth/login` with `{"identifier":{"$ne":""},"password":{"$gt":""}}` | Reject `$` operator object with `400` before querying MongoDB | **Pass** (`400 Bad Request`) |
| SEC-02 | NoSQL Injection (Query & Dotted Keys) | `GET /api/books?q[$regex]=.*` and `POST /api/books` containing `"owner.role": "admin"` | Reject `$regex` query param and dotted keys with `400` | **Pass** (`400 Bad Request`) |
| SEC-03 | SQL Injection Payloads | `POST /api/auth/login` with `' OR '1'='1` and `GET /api/books?q='; DROP TABLE books; --` | Treated as literal strings; login returns `401`, search returns `200` empty array | **Pass** (`401` / `200 []`) |
| SEC-04 | Stored XSS | `POST /api/books` with `<script>alert("XSS")</script>Discrete Mathematics` and `<img src=x onerror=alert(1)>` | Script tags and `onerror=` attributes stripped before saving to MongoDB | **Pass** (Clean strings stored) |
| SEC-05 | Privilege Escalation | `POST /api/auth/register` including `"role": "admin"` in request body | Server ignores `role` field and forces `"student"` | **Pass** (`user.role === "student"`) |
| SEC-06 | Unauthenticated Access & Headers | `POST /api/books` without Bearer token; inspect response headers | Returns `401 Unauthorized`; `x-content-type-options: nosniff`, no `x-powered-by` | **Pass** (`401` + Headers verified) |
| IT-05 | IDOR / Private Messaging Access Control | 3rd student calls `GET` / `POST /api/requests/:id/messages` | Returns `403 Forbidden` | **Pass** (`403 Forbidden`) |
| RBAC-01/02 | Setup Key & Multi-Role Escalation | Wrong setup key; Student accessing `/admin/*`; Team Admin modifying `super_admin`, team, settings, or backups | Returns `403 Forbidden` and records unauthorized modification alert | **Pass** (`403 Forbidden` + Alert logged) |
| RBAC-03 | Audit Log Immutability | `DELETE /api/admin/audit-logs/:id` and `AuditLog.deleteOne()` | Blocked at both HTTP (`403`) and Mongoose hook layers | **Pass** (Immutable) |
| RBAC-04 | Auto-Suspension Safeguard | 4 consecutive failed logins triggering `repeated_failed_login` alert | Alert created for human review; account remains `isSuspended: false` | **Pass** (No auto-ban) |
