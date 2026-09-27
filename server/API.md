# StayBridge API contract

Base: `/api`. JSON bodies. All state-changing requests (POST/PUT/PATCH/DELETE) MUST send header `X-Requested-With: fetch` and the session cookie (`credentials: 'include'`). Errors: `{ error, code?, details? }` with status 400/401/403/404/409/413/429/500. Dates are ISO strings. Money is integer whole units.

Privacy is enforced server-side by `src/lib/serialize.ts`: renters never receive owner contact or listing `address` until `contactUnlocked`; owners never receive an application before status `sent_to_owner`, never the renter's full name/email/phone until `contactUnlocked`, never `renterFee`, `idNumberMasked`, file ids or `adminNotes`; admins receive everything.

## Auth (implemented)
- `POST /auth/signup` {name,email,password,role:'renter'|'owner',phone?} → 201 {user}
- `POST /auth/login` {email,password} → {user}  (429 on lockout)
- `POST /auth/logout` → 204
- `GET /auth/me` → {user|null, fees}
- `PATCH /auth/me` {name?,phone?,bio?} → {user}
- `POST /auth/change-password` {currentPassword,newPassword} → 204

## Files (implemented)
- `POST /files?kind=listing_photo|id_document|selfie|proof_of_income` multipart field `files` (≤8 files, ≤8MB each) → 201 {files:[{id,kind,mime,size,name,url,createdAt}]}
- `GET /files/:id` → bytes. Public kinds are cacheable; private kinds only for uploader or admin (404 otherwise).

## Listings
- `GET /listings?city&type&min&max&beds&furnished&bills&stay&q&sort=featured|price_asc|price_desc|newest&page&limit` → {items:[Listing], total, page, limit, cities:[string]}  (public; only `active`; featured first by default)
- `GET /listings/:id` → {listing, owner: PublicUser, ownerRating:{avg,count}, similar:[Listing]}  (public if active; owner/admin can see any status; renters with an application on it can see it). Increments `views` once per session (GET is fine; dedupe by session+listing in memory).
- `POST /listings` (owner) body = ListingInput {title,description,type,city,area,address,price,deposit,billsIncluded,availableFrom,minStayMonths,bedrooms,bathrooms,sizeSqm,furnished,amenities[],houseRules[],images[] (each `/api/files/<id>` owned by caller with kind listing_photo, or https URL), status:'draft'|'pending_review'} → 201 {listing}
- `PATCH /listings/:id` (owner of it, or admin) partial ListingInput + status transitions the owner may make: draft/rejected→pending_review, active↔paused, active/paused→rented. Editing an active listing keeps it active. → {listing}
- `POST /listings/:id/feature` (owner) mock payment {card:{number,exp,cvc}} → records a `purchases` row, sets featured=true, featuredUntil=+30d → {listing}
- `GET /me/listings` (owner) → {items:[Listing with applicantsCount]}
- `POST /listings/:id/save` / `DELETE /listings/:id/save` (renter) → {saved:boolean}
- `GET /me/saved` (renter) → {items:[Listing]}

## Applications
- `POST /applications` (renter) {listingId, proposedPrice, moveInDate, stayMonths, message, agreementAccepted:true, verification:{idType, idNumber (server masks to last 4 and DISCARDS the rest), idDocumentFileId, selfieFileId, proofOfIncomeFileId?}, profile:{occupation,employer?,monthlyIncome,occupants,hasPets,smoker,aboutMe,references?}} → 201 {application}. Rules: listing must be active; one non-terminal application per renter per listing (409); proposedPrice within 40%–200% of asking; fees computed server-side with the renter's Tenant Pass; sets renter verification to 'pending' if 'unverified'; event 'submitted'; notifies all admins.
- `GET /me/applications` → renter: their own; owner: only those with status in OWNER_VISIBLE_STATUSES for their listings, plus `verifyingCount` per listing (count only, no details); admin: all (supports ?status&q). → {items:[Application + listing summary {id,title,city,area,images[0],price,currency} + counterpart PublicUser], verifyingCounts?:{[listingId]:n}}
- `GET /applications/:id` → {application, listing, renter: user (serialized per viewer), owner: user (serialized per viewer), events:[{status,by,note,at}], messagesCount, myReview?: Review}. Owner gets 404 while status not in OWNER_VISIBLE_STATUSES.
- `POST /applications/:id/transition` {status, note?} — allowed transitions by role (server is the single source of truth for the state machine):
  - admin: submitted→under_review|verified|rejected; under_review→verified|rejected; verified→sent_to_owner; sent_to_owner→owner_accepted|owner_declined (on owner's behalf, note gets suffix "(recorded by admin on owner's behalf)"); contact_unlocked→completed; any non-terminal→cancelled
  - owner: sent_to_owner→owner_accepted|owner_declined (note required for decline, ≥5 chars); contact_unlocked→completed
  - renter: any non-terminal and not contact_unlocked→cancelled
  Side effects (mirror the client store's advanceApplication): verified→ set renter user verification 'verified' + notify renter; rejected→notify renter; sent_to_owner→notify owner+renter; owner_accepted→ ALSO immediately transition to awaiting_fees (by system) + notify renter & admins; owner_declined→notify renter; completed→ listing status 'rented' + notify both. Every transition writes an application_events row and an audit row. → {application, events}
- `PATCH /applications/:id/price` (admin) {agreedPrice} → recomputes fees (locked once any fee paid / unlocked / terminal) → {application}
- `PATCH /applications/:id/notes` (admin) {adminNotes} → {application}
- `POST /applications/:id/pay` (renter pays renter side; owner pays owner side) {card:{number,exp,cvc}} — only when status awaiting_fees; records a `payments` row (provider 'mock'); when both paid → contactUnlocked=true and transition to contact_unlocked (by system) + notify both. → {application}
- `POST /applications/:id/mark-paid` (admin) {side:'renter'|'owner'} — offline payment, same unlock logic, recordedBy admin → {application}

## Messages
- `GET /me/conversations` → {items:[{application: {id,status,listing:{id,title}}, counterpart: PublicUser (full name since unlocked), lastMessage?, unread?}]} — only applications with contactUnlocked where caller is renter/owner; admin gets all.
- `GET /applications/:id/messages` → {items:[Message]} (participants or admin; 403 if not unlocked)
- `POST /applications/:id/messages` {text ≤2000} (participants only, not admin) → 201 {message} + notify counterpart

## Reviews
- `POST /applications/:id/reviews` {rating 1–5, text 10–1000} — only when status completed, caller is renter or owner of it, one per caller per application → 201 {review}
- `GET /users/:id/reviews` → {items:[Review + from: PublicUser], avg, count}

## Notifications
- `GET /me/notifications?limit=20` → {items, unread}
- `POST /me/notifications/read` {id?} (all when omitted) → 204

## Purchases
- `POST /me/tenant-pass` (renter) {card} → records purchase, hasTenantPass=true → {user}

## Admin
- `GET /admin/overview` → {revenueCollected, revenuePending, purchasesCollected, pendingApprovals, counts:{toVerify, readyToSend, waitingOnOwner, awaitingFees, completed, listingsPending, listingsLive, listingsFeatured, usersByRole, pendingApprovals}, pipeline:{[status]:count}, recentEvents:[{application:{id,renterName,listingTitle}, status, by, note, at}]}  (`pendingApprovals` = AI proposals with status pending)
- `GET /admin/users?q&role` → {items:[FullUser + applicationsCount + listingsCount + rating]}
- `PATCH /admin/users/:id/verification` {verification} (cannot change self) → {user}
- `GET /admin/listings?status&q&owner` → {items:[Listing + owner name]}
- `PATCH /admin/listings/:id` {status?, rejectionReason?, featured?} → {listing} (+ notify owner on approve/reject)
- `GET /admin/settings` → {fees}; `PUT /admin/settings` {fees} → {fees}
- `GET /admin/audit?limit=100` → {items}
- `POST /admin/reset-demo` (only when NODE_ENV!=='production') → wipes and reseeds → 204

## AI employees (admin only)
Design: `src/agents/README.md`. Four employees (`moderator` Maya, `verifier` Victor, `deals` Dana, `growth` Gabe) turn work items into **proposals**. Policy (`src/agents/actions.ts` defaults + CEO overrides) decides per proposal: `auto` and confidence ≥ threshold → executed immediately (`decidedBy:'policy'`); `approve` or below threshold → `pending` in the Approvals inbox; `never` → `pending` with `payload.adviceOnly:true` (approving only acknowledges, nothing executes). `application.mark_fee_paid` and `settings.fees` can never be set to `auto`. All routes require role admin (401 anonymous, 403 other roles). Every admin action here writes an audit row (`proposal.approve`, `proposal.reject`, `agent.run`, `agent.run_all`, `agent.enable`, `agent.policy`); every execution writes `agent.execute` with actor = admin id or `agent:<key>`.

Types:
- **Run** `{id, agentKey, agentName, trigger:'schedule'|'manual'|'event', status:'running'|'succeeded'|'failed'|'skipped', summary, itemsReviewed, proposalsCreated, autoExecuted, inputTokens, outputTokens, costCents, error:string|null, startedAt, finishedAt:string|null}`
- **Agent** `{key, name, title, description, schedule:'cycle'|'daily', enabled, running, lastRun: {id, agentKey, agentName, trigger, status, summary, startedAt, finishedAt, itemsReviewed, proposalsCreated, autoExecuted, costCents}|null, pendingProposals}`
- **PolicyAction** `{key, label, description, targetType, defaultAutonomy, autonomy:'auto'|'approve'|'never', autoMinConfidence, defaultAutoMinConfidence, locked:boolean}` (`locked` = can never be auto)
- **Proposal** `{id, agentKey, agentName, action, actionLabel, targetType:'listing'|'application'|'user'|'settings'|'none', targetId:string|null, target:{title, link:string|null, status?}|null, payload:object, adviceOnly:boolean, rationale, confidence:0-100, risk:'low'|'medium'|'high', status:'pending'|'approved'|'rejected'|'executed'|'failed'|'expired', decidedBy:string|null (admin id or 'policy'), decidedByName:string|null, decidedAt:string|null, decisionNote:string|null, executedAt:string|null, result:string|null, runId:string|null, createdAt}`
  - `target.link` is an in-app route: listing → `/admin/listings?tab=<status>`, application → `/admin/applications/:id`, user → `/admin/users`, settings → `/admin/settings`.
  - Payload by action: `listing.approve` {flags[], escalated?}; `listing.reject` {rejectionReason, flags[]}; `listing.pause` {applicationId, daysWaiting}; `application.verify|reject` {checks:{docLegible,nameMatches,faceMatches,affordability,messageGenuine}, renterFacingReason? (reject), escalated?}; `application.set_price` {suggestedPrice, agreedPrice (same value), currentPrice, proposedPrice, askingPrice, currency}; `application.nudge` {to:'renter'|'owner', message}; `application.mark_fee_paid` {side}; `application.record_owner_decision` {decision:'accept'|'decline', note?}; `user.notify` {title, message, link?, listingId?}; `settings.fees` {fees:{renterFeeRate?,ownerFeeRate?,minFee?}, current}; `ceo.brief` {text ≤1200 chars}.
  - An escalation is a normal action proposal with `confidence: 0` and rationale starting "Escalated:" (e.g. Maya escalating a listing = `listing.approve` at 0).
  - Pending proposals older than 7 days become `expired`.

Endpoints:
- `GET /admin/agents` → {configured:boolean, model, intervalMinutes, budgetCents, spentThisMonthCents, agents:[Agent]}
- `POST /admin/agents/:key/run` → runs that employee now (awaits the run, up to ~2 min) → {run: Run}. 404 unknown key; 409 if that employee is already running. Manual runs ignore the on/off switch and Gabe's once-a-day limit; they still respect "not configured" and the budget cap (→ run with status `skipped` and a summary).
- `POST /admin/agents/run-all` → runs all four in order → {runs:[Run]}; 409 if a cycle is already running.
- `PATCH /admin/agents/:key` {enabled:boolean} → {agent: Agent}
- `GET /admin/agents/policy` → {actions:[PolicyAction]}
- `PUT /admin/agents/policy` partial map of changed actions only {[actionKey]:{autonomy?, autoMinConfidence? (int 0-100)}} → {actions:[PolicyAction]} (full list). 400 for unknown keys or `auto` on a locked action.
- `GET /admin/agents/runs?agent&limit=50 (≤200)` → {items:[Run]} newest first
- `GET /admin/proposals?status=pending|all|<status>&agent&limit=100 (≤200)` → {items:[Proposal]} newest first (default status `pending`)
- `GET /admin/proposals/:id` → {proposal: Proposal, run: Run|null}
- `POST /admin/proposals/:id/approve` {note?} (body may be `{}` or empty) → {proposal} — executes through the same server code as the admin UI (state machine, listing moderation, notifications). On execution error the proposal comes back with `status:'failed'` and `result` = the message (HTTP 200). 409 if not pending.
- `POST /admin/proposals/:id/reject` {note?} → {proposal}; 409 if not pending.
- `POST /admin/proposals/bulk` {ids:[1..100], decision:'approve'|'reject', note?} → {results:[{id, ok:boolean, status?, result?, proposal?: Proposal, error?}]} (`ok:false` for failures or proposals that were not pending)

Env: `ANTHROPIC_API_KEY` (unset → `configured:false`, no scheduler, runs are skipped), `AGENT_MODEL` (default `claude-opus-5`), `AGENT_INTERVAL_MINUTES` (default 10; 0 = no interval, event hooks only), `AGENT_MONTHLY_BUDGET_CENTS` (default 5000). New listings submitted for review and new applications wake Maya / Victor after a 30 s debounce.
