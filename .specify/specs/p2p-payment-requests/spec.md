# Spec: P2P Payment Request Feature

## Overview
A Venmo/Cash App-style payment request system. Users request money from others via email. Recipients pay, decline, or schedule payment. Requests expire after 7 days.

## User Stories

### Sender
- As a sender, I can request money from anyone by email + amount + optional note
- As a sender, I get a shareable link (UUID) to send to the recipient
- As a sender, I can cancel a pending request
- As a sender, I can repeat a request once if it was declined
- As a sender, I see all my outgoing requests with status

### Recipient
- As a recipient, I receive an email with request details and a link
- As a recipient (registered), I can Pay Now or Schedule Payment
- As a recipient (unregistered), I see request preview and sign up prompt
- As a recipient, I can decline a request
- As a recipient, I see all my incoming requests with status

## Functional Requirements

### Request Creation
- Inputs: recipient email, amount (> 0), optional note (max 500 chars, no bad words)
- Generates UUID, sets expires_at = NOW + 7 days, status = 1 (pending)
- If recipient registered: set recipient_id immediately
- If recipient unregistered: send email invite with link

### Status Transitions
```
1 (pending) → 2 (paid)       via Pay Now or Scheduled execution
1 (pending) → 3 (declined)   via recipient Decline
1 (pending) → 4 (expired)    via cron job or page load check
1 (pending) → 5 (scheduled)  via Schedule Payment
1 (pending) → 6 (cancelled)  via sender Cancel
5 (scheduled) → 2 (paid)     via cron job execution
5 (scheduled) → 7 (failed)   via cron job (insufficient balance)
7 (failed) → 2 (paid)        via Pay Now retry
7 (failed) → 5 (scheduled)   via Reschedule retry
3 (declined) → [new request]  via Repeat (once only)
```

### Expiration
- expires_at = created_at + 7 days
- Cron job (daily, Vercel Hobby plan): SET expired=1 WHERE expires_at < NOW AND status IN (1,5) AND expired=0
- Page load: check and set expired=1 if overdue
- expired=1 is permanent — never reverts
- UI shows real-time countdown

### Scheduled Payments
- User picks a date ≤ expires_at
- Cron job (daily, Vercel Hobby plan): execute payments where scheduled_payment_date ≤ NOW AND status=5
- On success: status=2, create payment_transaction
- On insufficient balance: status=7, notify user "1 retry remaining"
- Retry: Pay Now immediately or Reschedule to new date

### Repeat Request
- Only if status=3 (declined) AND repeated=0
- Creates brand new request (new UUID, new expires_at)
- Sets old request repeated=1 (immutable)
- Only sender can trigger

### Unregistered Recipient
- Link /requests/[UUID]: shows "A payment request was sent to you. Log in to see details."
- After login: validates recipient_email = auth.email, shows full details
- On signup: DB trigger auto-sets recipient_id for all matching pending requests

### Balance System
- Mock only — no real payment gateway
- Every user starts with $10,000 (1,000,000 cents)
- Dashboard shows balance with manual Add/Subtract input
- Pay Now: atomic transaction — deduct sender, credit recipient, update status

## Error Cases
| Scenario | Behavior |
|----------|----------|
| Pay after expiration | Server rejects: expired=1 check |
| Double-click Pay | Button disabled during loading + server status check |
| Scheduled pay, insufficient balance | status=7, offer retry |
| Wrong user opens shareable link | 403 after login |
| Bad words in note | Validation error, re-enter |
| Repeat after repeated=1 | Button disabled, "You already repeated this request" |
