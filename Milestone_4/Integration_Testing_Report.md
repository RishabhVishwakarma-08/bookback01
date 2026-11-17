# BookBack — Integration Testing Report (Milestone 4)

## 1. Overview
Integration testing checks how the **Express REST API**, **Authentication & RBAC Middleware**, **Business Rules**, **Discrepancy Detector**, and **MongoDB (Mongoose)** database work together as a complete system. Rather than mocking the database, every integration test runs HTTP requests via **Supertest** against a real MongoDB instance (`MongoMemoryServer`) using the exact Mongoose schemas and Express routers from `server/app.ts`.

## 2. Technology Stack Note
Consistent with the **System Design Document (SDD v1.0)** and **Milestone 3**, BookBack uses React, Node.js/Express, and MongoDB instead of the PHP/MySQL stack drafted in Milestone 2.

## 3. Beginner-Friendly Explanation of What Was Tested
Think of integration testing as walking multiple student and administrative accounts through the real app from start to finish:
1. Students register and log in (duplicate emails or roll numbers are blocked, and private `passwordHash` is omitted).
2. A student lists a textbook and a buyer searches for it by keyword, semester, and popularity.
3. The buyer requests the book, both exchange private messages, and in-app notifications fire automatically.
4. A third student tries to peek at their private conversation and is blocked (`403 Forbidden`).
5. The owner accepts the request (creating a Transaction record), completes the handover, and receives a 5-star review.
6. The one-time `/api/setup/initialize` endpoint validates `ADMIN_SETUP_KEY`, creates the Main Owner (`super_admin`) and Team Admins 1 & 2 (`team_admin`), and locks itself afterwards.
7. All 4 roles (`super_admin`, `team_admin` 1, `team_admin` 2, `student`) are tested for strict RBAC boundaries, mandatory audit reasons, tamper-resistant activity logs, Super Admin record restoration, automated discrepancy detection/review, database backup/restore, CSV exports, and profile theme persistence.

## 4. Actual Test Cases & Observed Results (`tests/integration.test.ts` & `tests/admin_rbac.test.ts`)
Executed via `npm test` (`vitest run`).

### Suite A: Student & Marketplace Core Journey (`tests/integration.test.ts` — 7 / 7 Passed)
| Test ID | Milestone Mapping | Scenario Tested | Expected HTTP / DB Outcome | Observed Status |
|---|---|---|---|---|
| IT-01 | M2 T01, T02 | Register senior, buyer, and outsider; block duplicate email; omit `passwordHash` | `201` on new accounts, `409` on duplicate email, `@mitsgwalior.in` auto-verified | **Pass** |
| IT-02 | M2 T03, T04 | Login using College ID + valid password vs wrong password | `200` with JWT token on valid login; `401` on wrong password | **Pass** |
| IT-03 | M2 T05–T08 | Create listing, search by keyword/semester/type, search missing title, view details | `201` created, `200` matching book, `[]` on missing title, private `email`/`collegeId` hidden | **Pass** |
| IT-04 | M3 E2E 4–6 | Reject self-request (`400`), create request (`201`), block duplicate request (`409`), reply (`201`), verify notifications | Owner gets `new_request`; buyer gets `new_message` | **Pass** |
| IT-05 | M3 E2E 7 | 3rd student attempts `GET` and `POST` on private request messages | Both requests rejected with `403 Forbidden` | **Pass** |
| IT-06 | SDD FR4, FR5 | Block buyer from accepting own request (`403`), owner accepts (`200` + Transaction), complete (`200`), review (`201`) | Seller profile shows `1` completed transaction and `5` avg rating | **Pass** |
| IT-07 | SDD FR6 | Student blocked from `/api/admin/*` (`403`); Admin logs in, verifies user with mandatory `reason`, checks `AuditLog` | Student receives `403`; Admin action & reason stored in `AuditLog` | **Pass** |

### Suite B: Multi-Role Governance, Discrepancies, Audit Recovery & Theme (`tests/admin_rbac.test.ts` — 5 / 5 Passed)
| Test ID | Scenario Tested | Expected HTTP / DB Outcome | Observed Status |
|---|---|---|---|
| RBAC-01 | Setup Wizard rejects invalid `setupKey`, initializes `super_admin` + `team_admin` 1 & 2, and locks setup afterwards | `403` on bad key, `201` on valid key, `403` on repeat setup attempt | **Pass** |
| RBAC-02 | Authenticate all 4 roles (`super_admin`, `team_admin` 1, `team_admin` 2, `student`) & test privilege boundaries | Students `403`; Team Admins `403` on `/admin/team`, `/admin/backups`, `/admin/settings` PATCH, and modifying Super Admin; Super Admin cannot be suspended (`403`) | **Pass** |
| RBAC-03 | Mandatory `reason` on mutations, Team Admin scoped audit visibility, log deletion block & Super Admin record restoration | `400` without reason; Team Admin 2 cannot view Team Admin 1 logs; `DELETE /admin/audit-logs/:id` returns `403`; Mongoose `deleteOne` throws; Super Admin restores book price `320 -> 380` | **Pass** |
| RBAC-04 | Trigger `quantity_anomaly`, `duplicate_listing`, `repeated_failed_login`, `availability_mismatch`, `unauthorized_modification` & test human investigation | All 5 discrepancy types flagged; failed logins do NOT auto-suspend user (`isSuspended === false`); notes appended (`201`) & status resolved (`false_positive`) | **Pass** |
| RBAC-05 | Backup snapshot create & restore, CSV export, `sort=popular` ranking & `themePreference` persistence | Snapshot restores original price; CSV export returns `text/csv`; popular sort ranks requested book first; profile persists `themePreference: "dark"` | **Pass** |

## 5. Summary
- **Total Integration Test Cases Passed**: **12 of 12** (`7/7` in `tests/integration.test.ts` + `5/5` in `tests/admin_rbac.test.ts`)
- **Failed**: **0**
- **Live Server Verification**: Verified against the running Express + Vite server on port `3000` (`GET /api/health`, `GET /api/setup/status`, `GET /api/platform-info`, `GET /api/books?sort=popular`, `GET /`, `GET /favicon.svg`).
