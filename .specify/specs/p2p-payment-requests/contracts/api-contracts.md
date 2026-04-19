# API Contracts: P2P Payment Requests

## Response Format Convention

### Success
```json
{ "data": { ...payload } }
```

### Error
```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message." } }
```

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
  "note": "Dinner last night"
}
```

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "link": "/requests/uuid",
    "expires_at": "2026-04-27T10:00:00Z",
    "status": 1
  }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INVALID_AMOUNT` | 400 | "Amount must be greater than zero." |
| `INVALID_EMAIL` | 400 | "Please enter a valid email address." |
| `NOTE_TOO_LONG` | 400 | "Note must be 500 characters or less." |
| `NOTE_INAPPROPRIATE` | 400 | "Note contains inappropriate language." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |

---

### GET /api/payment-requests
List requests for the authenticated user.

**Query Params**
```
type=incoming|outgoing
status=1,2,3          (comma-separated, optional)
search=name           (sender/recipient name, optional)
amount_min=1000       (cents, optional)
amount_max=50000      (cents, optional)
```

**Response 200**
```json
{
  "data": [
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
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |

---

### GET /api/payment-requests/:id
Get request detail. Triggers expiry check on load.

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "amount": 10000,
    "status": 1,
    "expires_at": "2026-04-27T10:00:00Z",
    "expired": 0,
    "repeated": 0,
    "scheduled_payment_date": null,
    "note": "Dinner",
    "link": "/requests/uuid",
    "sender": { "id": "uuid", "first_name": "Ali", "last_name": "Yilmaz", "email": "ali@example.com" },
    "recipient": { "id": "uuid", "first_name": "Mehmet", "last_name": "Kaya", "email": "mehmet@example.com" },
    "created_at": "2026-04-20T10:00:00Z"
  }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `NOT_FOUND` | 404 | "Payment request not found." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "You don't have access to this request." |

---

### POST /api/payment-requests/:id/pay
Pay a request immediately.

**Request** *(no body required)*

**Response 200**
```json
{
  "data": {
    "transaction_id": "uuid",
    "new_balance": 90000
  }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INSUFFICIENT_BALANCE` | 400 | "Your balance is too low to complete this payment." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "Only the recipient can pay this request." |
| `REQUEST_EXPIRED` | 409 | "This payment request has expired." |
| `INVALID_STATUS` | 409 | "This request cannot be paid in its current state." |

---

### POST /api/payment-requests/:id/schedule
Schedule a payment for a future date.

**Request**
```json
{
  "scheduled_payment_date": "2026-04-25T10:00:00Z"
}
```

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "status": 5,
    "scheduled_payment_date": "2026-04-25T10:00:00Z"
  }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INVALID_DATE` | 400 | "Scheduled date must be before the request expiration date." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "Only the recipient can schedule this request." |
| `REQUEST_EXPIRED` | 409 | "This payment request has expired." |
| `INVALID_STATUS` | 409 | "This request cannot be scheduled in its current state." |

---

### POST /api/payment-requests/:id/decline
Decline an incoming request.

**Request** *(no body required)*

**Response 200**
```json
{
  "data": { "id": "uuid", "status": 3 }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "Only the recipient can decline this request." |
| `INVALID_STATUS` | 409 | "This request cannot be declined in its current state." |

---

### POST /api/payment-requests/:id/cancel
Cancel an outgoing request (sender only, pending only).

**Request** *(no body required)*

**Response 200**
```json
{
  "data": { "id": "uuid", "status": 6 }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "Only the sender can cancel this request." |
| `INVALID_STATUS` | 409 | "Only pending requests can be cancelled." |

---

### POST /api/payment-requests/:id/retry
Retry a failed scheduled payment.

**Request**
```json
{
  "type": "pay_now"
}
```
or
```json
{
  "type": "reschedule",
  "scheduled_payment_date": "2026-04-26T10:00:00Z"
}
```

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "status": 2,
    "transaction_id": "uuid",
    "new_balance": 90000
  }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `INSUFFICIENT_BALANCE` | 400 | "Your balance is too low to complete this payment." |
| `INVALID_DATE` | 400 | "Scheduled date must be before the request expiration date." |
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "Only the recipient can retry this request." |
| `INVALID_STATUS` | 409 | "Only failed requests can be retried." |

---

### POST /api/payment-requests/:id/repeat
Repeat a declined request (sender only, once only).

**Request** *(no body required)*

**Response 201**
```json
{
  "data": {
    "id": "new-uuid",
    "link": "/requests/new-uuid",
    "expires_at": "2026-04-27T10:00:00Z",
    "status": 1
  }
}
```

**Errors**
| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | "You must be logged in." |
| `FORBIDDEN` | 403 | "Only the sender can repeat this request." |
| `ALREADY_REPEATED` | 409 | "You already repeated this request." |
| `INVALID_STATUS` | 409 | "Only declined requests can be repeated." |

---

## Cron Endpoints (internal, secured by CRON_SECRET header)

### GET /api/cron/expire
Sets expired=1 for all overdue requests.

**Response 200**
```json
{ "data": { "updated_count": 12 } }
```

### GET /api/cron/execute-scheduled
Executes all due scheduled payments.

**Response 200**
```json
{
  "data": {
    "executed": 5,
    "failed": 2
  }
}
```
