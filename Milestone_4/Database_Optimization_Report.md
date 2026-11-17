# BookBack — Database Optimization Report (Milestone 4)

## 1. Overview
As campus adoption grows, searching and filtering textbooks by status, semester, branch, offer type, and keyword becomes the most frequent database operation. Without indexes, MongoDB performs a **Collection Scan (`COLLSCAN`)**—reading every single document in the collection and sorting results in memory.

This report documents the MongoDB schema relationships, index design, and real `explain('executionStats')` benchmark measurements conducted on **1,000 `BookListing` documents** (`tests/db_benchmark.ts`).

## 2. Database Architecture & Relationships (MongoDB / Mongoose)
Although Milestone 2 initially outlined relational MySQL tables, BookBack implements the **System Design Document (SDD v1.0)** MongoDB architecture using Mongoose ObjectId references and schema validation:
- `Campus` (1) → `User` (many) via `campusId`
- `User` (1) → `BookListing` (many) via `ownerId`
- `BookListing` (1) → `BookRequest` (many) via `listingId`
- `BookRequest` (1) → `Transaction` (0..1) via unique `requestId`
- `BookRequest` (1) → `RequestMessage` (many) via `requestId`
- `Transaction` (1) → `Review` (many, constrained to 1 per reviewer via unique compound index `{ transactionId: 1, reviewerId: 1 }`)
- `User` (1) → `Notification`, `Report`, `AuditLog`

## 3. Implemented Indexes
In `server/models/`:
1. **`BookListing` Compound Filter & Sort Indexes**:
   - `{ status: 1, semester: 1, offerType: 1, createdAt: -1 }` — Covers the primary catalog filter (Available books by Semester + Offer Type sorted newest first) without an in-memory sort.
   - `{ status: 1, branch: 1, createdAt: -1 }` — Optimizes branch-specific dashboard recommendations.
   - `{ ownerId: 1, status: 1, createdAt: -1 }` — Optimizes a student's "My Listings" dashboard table.
   - Weighted Text Index `{ title: 'text', author: 'text', subject: 'text', course: 'text', isbn: 'text' }`.
2. **`BookRequest` Indexes**:
   - `{ ownerId: 1, status: 1, updatedAt: -1 }` and `{ requesterId: 1, status: 1, updatedAt: -1 }` for fast request inbox loading.
   - Partial Unique Index `{ listingId: 1, requesterId: 1 }` where `status` is `pending` or `accepted` — Enforces duplicate-request prevention directly at the database engine level.
3. **`Notification` Index**:
   - `{ userId: 1, isRead: 1, createdAt: -1 }` — Speeds up unread notification badge counts and inbox loading.

## 4. Measured Query Benchmark (`tests/db_benchmark.ts`)
Benchmark dataset: **1,000 `BookListing` documents** in MongoDB (WiredTiger).
Target query: `BookListing.find({ status: 'available', semester: 4, offerType: 'sell' }).sort({ createdAt: -1 })`.

| Metric | Before Index (Forced `$natural` Scan) | After Compound Index (`status_1_semester_1_offerType_1_createdAt_-1`) | Improvement |
|---|---|---|---|
| **Execution Stage** | `SORT` (over `COLLSCAN`) | `IXSCAN` (index-ordered, no in-memory sort) | Eliminated blocking `SORT` stage |
| **Documents Returned (`nReturned`)** | 31 | 31 | Identical accurate result |
| **Documents Examined (`totalDocsExamined`)** | 1,000 | 31 | **96.9% fewer documents read** |
| **Index Keys Examined (`totalKeysExamined`)** | 0 | 31 | Targeted B-tree lookup |
| **Execution Time (`executionTimeMillis`)** | 1 ms | 0 ms (< 1 ms) | Sub-millisecond lookup |

### Beginner-Friendly Takeaway
Imagine looking for all 4th-semester CSE books for sale in a pile of 1,000 unsorted index cards. Without an index, the database has to flip through all 1,000 cards and then sort the matches afterward. With our compound index, MongoDB jumps straight to the 31 matching cards already arranged from newest to oldest.

## 5. Additional Query Optimizations Applied
- **Lean Queries (`.lean()`)**: Read-only `GET` routes use Mongoose `.lean()` to return plain JavaScript objects instead of heavy hydrated Mongoose documents, lowering memory overhead.
- **Parallel Fetching (`Promise.all`)**: Catalog pagination (`find` + `countDocuments`), admin overview stats, and dashboard queries run concurrently via `Promise.all`.
- **Projection Restraint**: Public queries explicitly project only safe owner fields (`name branch year semester verified`) so `passwordHash`, `email`, and `collegeId` are never transferred unnecessarily.
