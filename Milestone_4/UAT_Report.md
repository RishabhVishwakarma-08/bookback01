# BookBack — User Acceptance Testing (UAT) Preparation & Verification Report (Milestone 4)

## 1. Purpose & Honesty Statement
User Acceptance Testing (UAT) validates whether real campus users—**Freshers (Buyers/Borrowers)**, **Seniors (Sellers/Lenders/Donors)**, and **Campus Admins**—can complete their goals smoothly on desktop and mobile devices.

> **Important Note on Beta Feedback**: External student beta testing has **not yet been conducted**. No external beta tester feedback or user quotes have been fabricated in this report. Section 3 provides the **UAT Execution Package** prepared for student testers, and Section 4 records the **Internal Developer/QA Pre-UAT Verification** actually run against the working application.

## 2. UAT Participant Groups (From SDD Personas)
1. **Group A — Fresher / Buyer & Borrower** (3–5 students): Searching for required semester books, comparing condition/price, sending borrow/buy requests, messaging owners.
2. **Group B — Senior / Seller & Lender** (3–5 students): Listing used textbooks with photos and deposit/price terms, accepting/declining requests, completing handovers.
3. **Group C — Campus Admin / Moderator** (1–2 faculty or library coordinators): Verifying non-campus accounts, moderating reported listings, reviewing audit logs.

## 3. UAT Test Scenarios & Acceptance Criteria (Prepared for Testers)

| UAT ID | Role | User Task | Acceptance Criteria | Tester Status |
|---|---|---|---|---|
| UAT-01 | Fresher | Register with college ID & `@mitsgwalior.in` email | Account created, auto-verified, redirected to Dashboard | *Pending External UAT* |
| UAT-02 | Fresher | Search for a 4th-semester textbook by title and filter by `Sell` | Matching books appear with clear price, condition, and owner summary | *Pending External UAT* |
| UAT-03 | Fresher | Open book details and send a request with pickup spot | Request saved; owner notified; duplicate request blocked | *Pending External UAT* |
| UAT-04 | Senior | List a textbook to `Lend` with refundable deposit & loan days | Listing appears in catalog and in Senior's Dashboard table | *Pending External UAT* |
| UAT-05 | Senior & Fresher | Exchange messages inside the request, accept request, complete handover, and leave review | Messages visible only to both parties; listing moves `available` → `reserved` → `completed`; review updates profile rating | *Pending External UAT* |
| UAT-06 | Admin | Verify a student account and resolve a flagged listing report | Verification badge updates on student profile; `AuditLog` records action | *Pending External UAT* |
| UAT-07 | All | Test mobile responsiveness (`375px` width) and desktop (`1440px` width) | No horizontal overflow; buttons easily tappable; navigation menu usable | *Pending External UAT* |

### UAT Feedback Collection Template (To Distribute to Student Testers)
- **Tester Role & Year**: (Fresher / Senior / Admin)
- **Device & Browser**: (e.g., Android Chrome / Windows Edge)
- **Task Completion (1–5 Ease Score)**: Could you complete all assigned scenarios without help?
- **Confusing Steps or Errors Encountered**:
- **Suggested UI/Feature Improvements**:

## 4. Internal Developer/QA Pre-UAT Verification (Actually Executed)
Before handing BookBack to student testers, the development team executed full automated and live-server checks on `http://localhost:3000`:
- **API & Persistence Check**: Verified `POST /api/auth/login`, `GET /api/books`, `GET /api/requests`, `GET /api/notifications`, and `GET /api/health` against the running Express + Vite server backed by persistent WiredTiger MongoDB files in `./data/mongodb`.
- **Automated E2E Journey**: All 7 multi-user workflow integration tests (`tests/integration.test.ts`) passed against MongoDB.
- **Production Build & Type-Check**: `npm run build` (`vite build`) and `npm run lint` (`tsc --noEmit`) passed with zero errors.
