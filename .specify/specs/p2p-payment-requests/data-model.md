# Data Model: P2P Payment Requests

## users
```sql
id          UUID        PK
email       TEXT        UNIQUE NOT NULL
first_name  TEXT        NOT NULL
last_name   TEXT        NOT NULL
balance     INTEGER     NOT NULL DEFAULT 1000000  -- cents, starts at $10,000
created_at  TIMESTAMP   DEFAULT NOW()
updated_at  TIMESTAMP   DEFAULT NOW()
```

## payment_requests
```sql
id                     UUID       PK  -- shareable link ID
sender_id              UUID       FK users.id NOT NULL
recipient_id           UUID       FK users.id NULLABLE  -- null until recipient registers
recipient_email        TEXT       NOT NULL               -- always stored
amount                 INTEGER    NOT NULL               -- cents
status                 INTEGER    NOT NULL DEFAULT 1
  -- 1=pending 2=paid 3=declined 4=expired 5=scheduled 6=cancelled 7=failed
expires_at             TIMESTAMP  NOT NULL               -- created_at + 7 days
scheduled_payment_date TIMESTAMP  NULLABLE
expired                INTEGER    NOT NULL DEFAULT 0     -- 0/1, immutable once 1
repeated               INTEGER    NOT NULL DEFAULT 0     -- 0/1, immutable once 1
note                   TEXT       NULLABLE               -- max 500 chars
created_at             TIMESTAMP  DEFAULT NOW()
updated_at             TIMESTAMP  DEFAULT NOW()
```

**Indexes:** (sender_id, status), (recipient_id, status), (expires_at), (scheduled_payment_date)

**RLS:** SELECT if sender_id = auth.uid() OR recipient_id = auth.uid()

## payment_transactions
```sql
id               UUID    PK
request_id       UUID    FK payment_requests.id
from_user_id     UUID    FK users.id
to_user_id       UUID    FK users.id
amount           INTEGER
transaction_type TEXT    -- 'manual_pay' | 'scheduled_execution' | 'retry_pay'
status           TEXT    -- 'success' | 'failed'
paid_at          TIMESTAMP
created_at       TIMESTAMP DEFAULT NOW()
```

## Key DB Functions (Supabase RPC)

### execute_payment(request_id, sender_id, amount)
Single transaction: INSERT payment_transaction + UPDATE balances + UPDATE request status.
Validates: status=1 AND expired=0 AND expires_at > NOW() AND balance >= amount.

### repeat_payment_request(request_id)
Validates: sender_id = auth.uid() AND status=3 AND repeated=0.
Creates new request, sets old repeated=1. Atomic.

### handle_new_user() [trigger on auth.users INSERT]
UPDATE payment_requests SET recipient_id = NEW.id
WHERE recipient_email = NEW.email AND recipient_id IS NULL AND status IN (1,5)
