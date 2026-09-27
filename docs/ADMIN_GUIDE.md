# Admin guide: running StayBridge as a business

This guide is for you, the operator. It walks through where the money comes from, what you do every day in the admin console, and the numbers to watch.

## 1. Where the money comes from

| Revenue line | Who pays | When | Default | Where you set it |
| --- | --- | --- | --- | --- |
| Renter service fee | Renter | Only after the owner accepts them | 50% of one month's rent, minimum $99 | Admin → Fees & settings |
| Owner success fee | Owner | Only after they accept a renter | 35% of one month's rent, minimum $99 | Admin → Fees & settings |
| Verified Tenant Pass | Renter | Any time, one-off | $29 | Admin → Fees & settings |
| Featured listing | Owner | Any time, 30 days | $39 | Admin → Fees & settings |

Worked example on a $1,200/month room: renter fee $600, owner fee $420, total $1,020 from one placement. A renter with a Tenant Pass pays 20% less ($480), which you already earned $29 for.

Nobody pays a service fee until a deal is agreed, so your job is to turn applications into agreed deals as fast as possible. Every stuck application is money sitting in the pipeline.

## 2. Your daily routine (15 to 30 minutes)

Sign in as admin and open **Overview**. The "Today's queue" card is your to-do list, in priority order.

### Step 1: Approve new listings (Listings → Pending review)
Supply drives everything. Open each pending listing, check the photos are real, the price is plausible for the area, and the description is not a scam pattern (too cheap, "owner abroad", asks for money up front). Approve or reject with a reason. Rejected owners get a notification and can fix and resubmit.

Tip: if a good listing has weak photos, approve it anyway and message the owner later to improve them. A live listing earns; a rejected one earns nothing.

### Step 2: Verify renters (Verification queue)
Tenant Pass holders sit at the top. That is deliberate: they paid for priority, and they are the renters most likely to complete a deal.

For each application:
1. Click **Start review** so the renter sees movement.
2. Open the ID document and selfie. Do the faces match, is the document unexpired, does the name match the account?
3. Check the profile: affordability ratio (income ÷ rent). Green is 3x or more, amber 2 to 3x, red under 2x. Owners rarely accept red.
4. Read the message to the owner. Does it sound like a real person?
5. **Approve verification** or **Reject** with a clear reason. Rejections are rare; be generous with borderline cases and let the owner decide.

### Step 3: Negotiate, then present to the owner
This is where you add the most value and where the intermediary model pays off.

- If the renter offered below asking, phone or email the owner first. Ask what the lowest they would accept is. Set the **agreed price** on the application record. Fees recalculate automatically.
- Then click **Send to owner**. The owner now sees the renter anonymised (first name and last initial, occupation, income ratio, about me) and can accept or decline.
- If you already spoke to the owner and they said yes, record it yourself with **Record owner accepted**. The timeline shows it was recorded by you.

Aim to present every verified renter within 24 hours. Speed is your main advantage over agencies.

### Step 4: Collect fees (Deal pipeline → Awaiting fees)
When an owner accepts, both sides get a notification and a pay button. Watch this column daily.

- After 2 days unpaid, message the slower side. The overview flags "chase fee" items after 3 days.
- If someone pays you by bank transfer instead, click **Mark renter fee received** or **Mark owner fee received** on the record. Contact unlocks automatically once both are marked paid.
- Nothing unlocks until both fees are in. Do not unlock manually as a favour; that is your only leverage.

### Step 5: Close the deal
Once contact is unlocked, the owner and renter talk directly. When the owner confirms the contract is signed (or you hear from either side), mark the application **completed**. The listing flips to rented, and both sides are prompted to leave a review. Reviews are what make the next renter's Tenant Pass worth buying.

## 3. Weekly

- **Chase stale owners.** Deal pipeline → "Sent to owner" older than 3 days. Call them. Owners who never respond should be paused so renters stop applying.
- **Sell Featured.** Overview shows live listings that are not featured. Message owners of good listings in busy cities and offer the 30-day boost. Owners who paid once tend to renew.
- **Check fees vs. conversion.** Fees & settings lets you change the rates. If renters accept but do not pay, the renter fee is too high. If owners decline good renters, the owner fee is too high. Change one number at a time and give it two weeks.
- **Review the audit log** (Admin → API `/admin/audit` or the settings page) for failed logins and locked accounts. Repeated lockouts on one email usually mean someone is guessing passwords.

## 4. Numbers to watch on the Overview

| Number | Healthy | If it is bad |
| --- | --- | --- |
| To verify | Under 24 hours old | You are the bottleneck. Verify twice a day. |
| Waiting on owner | Under 3 days | Owners are slow. Call them. Pause unresponsive listings. |
| Awaiting fees | Under 2 days | Chase. Consider lowering the renter fee. |
| Pending revenue | Rising | Good, but it is not cash until paid. |
| Revenue collected | Rising month over month | Your real income. |

## 5. Pricing advice

The defaults (50% renter, 35% owner) add up to 85% of a month's rent. That is high. It works for scarce markets and premium listings where a renter is happy to pay to skip the queue. In a normal market, start lower and raise it once you have reviews:

- Renter 25 to 35%, owner 25%, minimum $79.
- Keep the Tenant Pass cheap ($19 to $29). It is a commitment device, not a profit line.
- Featured listings are almost pure margin. Price them at roughly one day of rent.

## 6. Ideas to add revenue later

- **Tenant screening report sold to owners.** You already collect income and ID. A summary PDF for $15 to $25 per applicant is easy margin.
- **Deposit protection.** Hold the deposit in escrow for a small percentage. Requires a payment provider and legal review.
- **Renewal fee.** When a tenancy renews after 12 months, charge the owner a reduced success fee.
- **Agency accounts.** Owners with 5 or more listings pay a monthly subscription instead of per-deal fees.
- **Relocation packages.** Sell a bundle (verification, priority, viewing coordination) to companies moving staff.

## 7. Rules that protect the business

- Never share owner contact before both fees are paid. The software prevents it; do not work around it by email.
- Never accept a renter you have not verified. One scammer costs you every owner in that city.
- Keep notes on every record (the internal notes box). Your future self, or an employee, will need them.
- Reset demo data is for testing only. It deletes everything. It is disabled in production.
