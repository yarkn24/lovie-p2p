# API Contracts: P2P Payment Requests

## Response Format Convention

### Success
Success responses return the resource directly (no envelope):

```json
{ "id": "uuid", "status": 1, "amount": 10000, ... }
```

List endpoints return an array directly:

```json
[{ "id": "uuid", ... }, { "id": "uuid", ... }]
```

### Error
All mutating endpoints return a Stripe/PayPal-style structured envelope:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "ERROR_CODE",
    "message": "Human-readable message.",
    "details": [{ "field": "amount", "issue": "must be greater than zero" }]
  }
}
```

`error.type` is one of: `invalid_request_error`, `authentication_error`,
`authorization_error`, `not_found_error`, `conflict_error`, `api_error`.
`error.details[]` is present only when field-level validation produced
structured issues.

## HTTP Status Codes
| Status | Meaning |
|--------|---------|
| 201 | Created successfully |
| 200 | Action completed successfully |
| 400 | Validation error (bad input) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | State conflict (expired, already paid, etc.) |
| 500 | Server error |

---

## Endpoints

### POST /api/payment-requests
Create a new payment request.

**Request**
```json
{
  "recipient_email": "mehmet@example.com",
  "amount": 10000,
  "note": "Dinner last night",
  "recipient_phone": "+15551234567"
}
```

**Response 201**
```json
{
  "id": "uuid",
  "link": "/requests/uuid",
  "expires_at": "2026-04-27T10:00:00Z",
  "status": 1
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INVALID_AMOUNT` | 400 | "Amount must be greater than zero." / "Amount exceeds $10,000 cap." |
| `INVALID_EMAIL` | 400 | "Please enter a valid email address." |
| `SELF_REQUEST` | 400 | "You cannot request money from yourself." |
| `NOTE_TOO_LONG` | 400 | "Note must be 500 characters or less." |
| `NOTE_INAPPROPRIATE` | 400 | "Note contains inappropriate language." |
| `INVALID_PHONE` | 400 | "Phone number format is invalid." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |

---

### GET /api/payment-requests
List requests for the authenticated user.

**Query Params**
```
direction=incoming|outgoing
status=1,2,3          (comma-separated, optional)
search=name           (sender/recipient name or note substring, optional)
```

**Response 200**
```json
[
  {
    "id": "uuid",
    "amount": 10000,
    "status": 1,
    "expires_at": "2026-04-27T10:00:00Z",
    "expired": 0,
    "note": "Dinner",
    "sender": { "id": "uuid", "first_name": "Ali", "last_name": "Yilmaz" },
    "recipient": { "id": "uuid", "first_name": "Mehmet", "last_name": "Kaya" },
    "created_at": "2026-04-20T10:00:00Z"
  }
]
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |

---

### GET /api/payment-requests/:id
Get request detail. Triggers single-row expiry check on load via
`expire_single_request` RPC.

**Response 200**
```json
{
  "id": "uuid",
  "amount": 10000,
  "status": 1,
  "expires_at": "2026-04-27T10:00:00Z",
  "expired": 0,
  "repeated": 0,
  "scheduled_payment_date": null,
  "failure_reason": null,
  "note": "Dinner",
  "link": "/requests/uuid",
  "sender": { "id": "uuid", "first_name": "Ali", "last_name": "Yilmaz", "email": "ali@example.com" },
  "recipient": { "id": "uuid", "first_name": "Mehmet", "last_name": "Kaya", "email": "mehmet@example.com" },
  "created_at": "2026-04-20T10:00:00Z"
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `REQUEST_NOT_FOUND` | 404 | "Payment request not found." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "You don't have access to this request." |

---

### POST /api/payment-requests/:id/pay
Pay a request immediately. Atomic via `execute_payment_v2` RPC
(`SELECT ... FOR UPDATE` + single transaction).

**Request** *(no body required)*

**Response 200** — the updated payment request row:
```json
{
  "id": "uuid",
  "status": 2,
  "amount": 10000,
  "...": "..."
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INSUFFICIENT_BALANCE` | 400 | "Your balance is insufficient to complete this payment." |
| `REQUEST_EXPIRED` | 400 | "This payment request has expired." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN_NOT_RECIPIENT` | 403 | "Only the recipient can pay this request." |
| `REQUEST_NOT_FOUND` | 404 | "Payment request not found." |
| `INVALID_STATUS` | 409 | "Request is no longer pending." |

---

### POST /api/payment-requests/:id/schedule
Schedule a payment for a future date (≤ expires_at).

**Request**
```json
{ "scheduled_payment_date": "2026-04-25T10:00:00Z" }
```

**Response 200** — updated row with `status: 5`.

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INVALID_DATE` | 400 | "scheduled_payment_date must be a valid ISO date." |
| `INVALID_SCHEDULE_DATE` | 400 | "scheduled_payment_date must be on or before the expiration date." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN_NOT_RECIPIENT` | 403 | "Only the recipient can schedule this request." |
| `REQUEST_EXPIRED` | 400 | "This payment request has expired." |
| `INVALID_STATUS` | 409 | "Request is not pending." |

---

### POST /api/payment-requests/:id/decline
Decline an incoming request (recipient only, status=1).

**Request** *(no body required)*

**Response 200** — updated row with `status: 3`.

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN_NOT_RECIPIENT` | 403 | "Only the recipient can decline this request." |
| `INVALID_STATUS` | 409 | "Only pending requests can be declined." |

---

### POST /api/payment-requests/:id/cancel
Cancel an outgoing request (sender only, status=1).

**Request** *(no body required)*

**Response 200** — updated row with `status: 6`.

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN_NOT_SENDER` | 403 | "Only the sender can cancel this request." |
| `INVALID_STATUS` | 409 | "Only pending requests can be cancelled." |

---

### POST /api/payment-requests/:id/retry
Retry a failed scheduled payment. Atomic via `execute_retry_payment_v2` RPC
for `pay_now`; CAS-guarded UPDATE for `reschedule`.

**Request**
```json
{ "action": "pay_now" }
```
or
```json
{ "action": "reschedule", "scheduled_payment_date": "2026-04-26T10:00:00Z" }
```

**Response 200** — updated row.

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INSUFFICIENT_BALANCE` | 400 | "Your balance is insufficient to complete this payment." |
| `INVALID_DATE` | 400 | "scheduled_payment_date must be a valid ISO date." |
| `INVALID_SCHEDULE_DATE` | 400 | "scheduled_payment_date must be on or before the expiration date." |
| `REQUEST_EXPIRED` | 400 | "This payment request has expired." |
| `MISSING_FIELD` | 400 | "action must be \"pay_now\" or \"reschedule\"." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN_NOT_RECIPIENT` | 403 | "Only the recipient can retry this request." |
| `INVALID_STATUS` | 409 | "Request is no longer in a failed state." |

---

### POST /api/payment-requests/:id/repeat
Repeat a declined or failed request (sender only, once only). Creates a new
pending request with a fresh 7-day expiry and marks the source row
`repeated=1`.

**Request** *(no body required)*

**Response 201** — new row.

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN_NOT_SENDER` | 403 | "Only the sender can repeat this request." |
| `ALREADY_REPEATED` | 409 | "This request has already been repeated once." |
| `INVALID_STATUS` | 409 | "Only declined or failed requests can be repeated." |

---

## Cron Endpoints (internal, secured by `Authorization: Bearer ${CRON_SECRET}`)

### GET /api/cron/expire
Bulk-expires all overdue pending/scheduled requests via
`expire_pending_requests` RPC.

**Response 200**
```json
{ "success": true, "message": "Expired requests processed" }
```

### GET /api/cron/execute-scheduled
Executes all due scheduled payments via `execute_scheduled_payments`
(`FOR UPDATE SKIP LOCKED` + per-row balance check), then fires failure
emails for rows that moved to status=7.

**Response 200**
```json
{ "success": true, "message": "Scheduled payments executed" }
```

---

## User / Balance

### GET /api/user/balance
Returns the authenticated user's own balance (in cents).

**Response 200**
```json
{ "balance": 1000000 }
```

### POST /api/user/balance
Demo-only: add/subtract from the authenticated user's own balance. Atomic
via `adjust_balance` RPC — RAISEs `INSUFFICIENT_BALANCE` if the adjustment
would go negative (no silent clamp).

**Request**
```json
{ "action": "add", "amount": 50 }
```

**Response 200**
```json
{ "balance": 1005000 }
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `MISSING_FIELD` | 400 | "Request validation failed." |
| `INVALID_AMOUNT` | 400 | "Amount rounds to zero." |
| `INSUFFICIENT_BALANCE` | 400 | "Your balance is insufficient for this adjustment." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
