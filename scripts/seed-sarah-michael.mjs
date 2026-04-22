/**
 * Adds 10 cross-requests between Sarah and Michael with varied statuses.
 *   node scripts/seed-sarah-michael.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

async function getUserId(email) {
  const { data } = await supabase.from('users').select('id').eq('email', email).single();
  return data?.id;
}

async function main() {
  const sarahId = await getUserId('sarah.demo@lovie.co');
  const michaelId = await getUserId('michael.demo@lovie.co');

  if (!sarahId || !michaelId) {
    console.error('Users not found — run npm run seed first');
    process.exit(1);
  }
  console.log(`Sarah: ${sarahId}`);
  console.log(`Michael: ${michaelId}`);

  const rows = [
    // Sarah → Michael (Sarah requested money from Michael)
    { sender_id: sarahId, recipient_id: michaelId, recipient_email: 'michael.demo@lovie.co', amount: 4500,  status: 1, note: 'Lunch at Nobu',              created_at: daysAgo(1),  expires_at: daysFromNow(6) },
    { sender_id: sarahId, recipient_id: michaelId, recipient_email: 'michael.demo@lovie.co', amount: 12000, status: 2, note: 'Concert tickets — Billie',    created_at: daysAgo(5),  expires_at: daysFromNow(2) },
    { sender_id: sarahId, recipient_id: michaelId, recipient_email: 'michael.demo@lovie.co', amount: 7800,  status: 3, note: 'Yoga class pack',              created_at: daysAgo(4),  expires_at: daysFromNow(3) },
    { sender_id: sarahId, recipient_id: michaelId, recipient_email: 'michael.demo@lovie.co', amount: 3200,  status: 5, note: 'Coffee & pastries',            created_at: daysAgo(2),  expires_at: daysFromNow(5), scheduled_payment_date: daysFromNow(3) },
    { sender_id: sarahId, recipient_id: michaelId, recipient_email: 'michael.demo@lovie.co', amount: 9500,  status: 2, note: 'Split Airbnb — weekend trip',  created_at: daysAgo(10), expires_at: daysFromNow(0) },

    // Michael → Sarah (Michael requested money from Sarah)
    { sender_id: michaelId, recipient_id: sarahId, recipient_email: 'sarah.demo@lovie.co', amount: 6000,  status: 1, note: 'Dinner at Osteria',             created_at: daysAgo(1),  expires_at: daysFromNow(6) },
    { sender_id: michaelId, recipient_id: sarahId, recipient_email: 'sarah.demo@lovie.co', amount: 2500,  status: 2, note: 'Parking — LAX',                 created_at: daysAgo(6),  expires_at: daysFromNow(1) },
    { sender_id: michaelId, recipient_id: sarahId, recipient_email: 'sarah.demo@lovie.co', amount: 18500, status: 1, note: 'Shared Hulu + Netflix',          created_at: daysAgo(0),  expires_at: daysFromNow(7) },
    { sender_id: michaelId, recipient_id: sarahId, recipient_email: 'sarah.demo@lovie.co', amount: 5000,  status: 6, note: 'Book club — drinks',             created_at: daysAgo(3),  expires_at: daysFromNow(4) },
    { sender_id: michaelId, recipient_id: sarahId, recipient_email: 'sarah.demo@lovie.co', amount: 11000, status: 2, note: 'Grocery run',                    created_at: daysAgo(8),  expires_at: daysFromNow(0) },
  ];

  const { data: inserted, error } = await supabase.from('payment_requests').insert(rows).select();
  if (error) { console.error(error); process.exit(1); }

  // Insert payment_transactions for paid (status=2) rows
  const tx = inserted
    .filter((r) => r.status === 2)
    .map((r) => ({
      request_id: r.id,
      from_user_id: r.recipient_id,
      to_user_id: r.sender_id,
      amount: r.amount,
      transaction_type: 'manual_pay',
      status: 'success',
      paid_at: r.created_at,
    }));

  if (tx.length) {
    const { error: txErr } = await supabase.from('payment_transactions').insert(tx);
    if (txErr) { console.error(txErr); process.exit(1); }
  }

  console.log(`✓ Inserted ${inserted.length} requests (${tx.length} with transactions)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
