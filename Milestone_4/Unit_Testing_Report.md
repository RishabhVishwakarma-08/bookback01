# BookBack — Unit Testing Report (Milestone 4)

## 1. Overview
Unit testing verifies individual, isolated functions and validation rules before they are connected to the database or web server. In BookBack, unit tests focus on two critical foundations:
1. **Security helper functions** (`server/utils/security.ts`): password hashing, login token creation/verification, XSS input cleaning, regex escaping, and NoSQL operator detection.
2. **Data validation rules** (`server/utils/validators.ts`): checking that registration forms, book listings, book requests, and reviews follow strict rules before reaching MongoDB.

## 2. Technology Stack Context
Milestone 2 originally sketched a PHP and MySQL prototype. Following the **System Design Document (SDD v1.0)** and **Milestone 3**, BookBack was implemented using **React (TypeScript)** on the frontend, **Node.js + Express** on the backend, and **MongoDB (Mongoose)** for persistent storage. Unit testing is executed with **Vitest**.

## 3. Beginner-Friendly Explanation of What Was Tested
- **Password Hashing (`bcrypt`)**: Instead of saving a student's real password in the database, BookBack scrambles it into an irreversible hash (`$2b$12$...`). The unit test proves the hash is never equal to the original password and only matches the exact right password.
- **JWT Tokens**: When a student logs in, the server issues a digitally signed pass (JWT). The unit test checks that a valid pass is accepted and even a 1-character tampered pass is rejected.
- **XSS & NoSQL Sanitization**: If someone types `<script>` tags or special database operator keys (`$ne`, `$gt`) into a form, the helper cleans or flags them before they reach the database.
- **Form Validation (`Zod`)**: Checks that a book marked `"sell"` must have a price greater than `0`, while a `"donate"` book must have price `0`, and reviews must stay between `1` and `5` stars.

## 4. Actual Test Cases & Observed Results (`tests/unit.test.ts`)
Executed via `npx vitest run --reporter=verbose`.

| Test ID | Module | Test Case Description | Expected Result | Observed Status | Duration |
|---|---|---|---|---|---|
| UT-01 | `security.ts` | Hash password with bcrypt (cost 12) and verify correct vs wrong password | Hash differs from plain text; right password returns `true`, wrong returns `false` | **Pass** | 1264 ms |
| UT-02 | `security.ts` | Sign JWT payload and verify valid vs tampered token | Valid token decodes `sub` and `role`; tampered token throws error | **Pass** | 7 ms |
| UT-03 | `security.ts` | Strip `<script>`, HTML tags, `onerror=`, and `javascript:` from text | Dangerous tags/handlers removed; clean text preserved | **Pass** | 1 ms |
| UT-04 | `security.ts` | Escape regex special characters in search strings (`+`, `(`, `)`, `[`, `]`, `?`, `*`) | Escaped pattern compiles safely without throwing RegExp errors | **Pass** | 1 ms |
| UT-05 | `security.ts` | Detect and strip `$`-prefixed and dotted NoSQL operator keys | `containsNoSqlOperator` detects `$ne` / dotted keys; `sanitizeObject` drops them | **Pass** | 1 ms |
| UT-06 | `validators.ts` | Validate complete student registration payload (`registerSchema`) | Accepts valid fields and normalizes email to lowercase | **Pass** | 4 ms |
| UT-07 | `validators.ts` | Reject short password and special-character `collegeId` on registration | Validation fails cleanly (`success: false`) | **Pass** | 1 ms |
| UT-08 | `validators.ts` | Enforce `price > 0` for `sell` and `price === 0` for `donate` (`createBookSchema`) | `sell` with price `0` rejected; `donate` with price `0` accepted | **Pass** | 3 ms |
| UT-09 | `validators.ts` | Validate request message min length and review rating bounds 1–5 | Short message and rating `6` rejected; valid inputs accepted | **Pass** | 2 ms |

## 5. Summary
- **Total Unit Tests Executed**: 9
- **Passed**: 9
- **Failed**: 0
- **Test File**: `tests/unit.test.ts`
