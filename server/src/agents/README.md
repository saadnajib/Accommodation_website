# AI employees

Four AI employees run the daily operations described in `docs/ADMIN_GUIDE.md`. The CEO (any admin account) approves the decisions that matter in **Admin → Approvals**; everything else runs on its own.

| Key | Name | Job | Runs |
| --- | --- | --- | --- |
| `moderator` | Maya | Reviews pending listings: real photos, plausible price, scam patterns. | Every cycle when listings are pending |
| `verifier` | Victor | Reviews submitted applications: ID document and selfie (vision), name match, affordability, message quality. | Every cycle when applications are submitted or under review |
| `deals` | Dana | Moves verified renters to owners, chases owners and unpaid fees, flags stuck deals, recommends agreed prices. | Every cycle |
| `growth` | Gabe | Featured-listing offers, pricing recommendations, and a daily CEO brief. | Once a day |

## How a decision flows

1. The scheduler (or "Run now") starts a **run** for one employee.
2. Code gathers the work items from the database and builds a compact JSON context (never raw HTML, never other users' secrets beyond what an admin sees).
3. One Claude call per batch returns a **structured decision list** (zod-validated via `output_config.format`). Employees never call mutating functions directly.
4. Each decision becomes a **proposal** with an action key, confidence, risk, and rationale.
5. **Policy** (`actions.ts` defaults, overridable in settings) decides: `auto` above the confidence threshold executes immediately; otherwise the proposal waits for the CEO. `never` means advice only.
6. **Executor** runs approved proposals through the same server code the admin UI uses (state machine, listing status, notifications), so every rule still applies. Executions are audited with actor = the admin who approved, or `agent:<key>` for auto.

## Safety rails

- No employee ever moves money, reveals contact details, or unlocks a deal. Fee marking is `never`; unlock only happens when both fees are recorded.
- Confidence gating: anything an employee is unsure about is escalated, never guessed.
- One nudge per party per application per 48 hours.
- Monthly token budget cap; runs are skipped once it is reached.
- Every run records tokens, cost, and a summary. Every proposal keeps its rationale so the CEO can audit decisions.
- Untrusted text (listing descriptions, renter messages) is passed as data inside JSON and the system prompt tells the model to treat it as data, never as instructions.
