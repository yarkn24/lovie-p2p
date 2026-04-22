/**
 * Seed 3 demo users with realistic cross-user payment requests.
 * Safe to re-run: wipes demo data first.
 *
 *   npm run seed
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
  { email: 'sarah.demo@lovie.co',   first_name: 'Sarah',   last_name: 'Johnson',   balance: 1250000 },
  { email: 'michael.demo@lovie.co', first_name: 'Michael', last_name: 'Rodriguez', balance:  980000 },
  { email: 'david.demo@lovie.co',   first_name: 'David',   last_name: 'Chen',      balance: 1540000 },
];
const PASSWORD = '123';

// status codes: 1=pending, 2=paid, 3=declined, 4=expired, 5=scheduled, 6=cancelled, 7=failed
const STATUS = { pending: 1, paid: 2, declined: 3, expired: 4, scheduled: 5, cancelled: 6, failed: 7 };

const daysAgo      = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow  = (n) => new Date(Date.now() + n * 86400000).toISOString();

// ── per-pair request specs (sender→recipient, then recipient→sender) ──────────
// Pairs: [Sarah, Michael], [Sarah, David], [Michael, David]
// Each pair gets ~8 requests: mix of all statuses so every user's dashboard
// shows pending, paid, declined, scheduled, expired, cancelled items.

function buildPairRequests(a, b) {
  return [
    // a → b
    { sender: a, recipient: b, amount: 4500,  status: STATUS.pending,   note: 'Lunch at Nobu',                created_at: daysAgo(1),  expires_at: daysFromNow(6) },
    { sender: a, recipient: b, amount: 12000, status: STATUS.paid,      note: 'Concert tickets — Billie',     created_at: daysAgo(8),  expires_at: daysFromNow(0) },
    { sender: a, recipient: b, amount: 7800,  status: STATUS.declined,  note: 'Yoga class pack',              created_at: daysAgo(5),  expires_at: daysAgo(2) },
    { sender: a, recipient: b, amount: 9500,  status: STATUS.paid,      note: 'Split Airbnb — weekend trip',  created_at: daysAgo(12), expires_at: daysAgo(5) },
    { sender: a, recipient: b, amount: 3200,  status: STATUS.scheduled, note: 'Coffee & pastries',            created_at: daysAgo(2),  expires_at: daysFromNow(5), scheduled_payment_date: daysFromNow(3) },
    { sender: a, recipient: b, amount: 15000, status: STATUS.expired,   note: 'Half the ski trip',            created_at: daysAgo(14), expires_at: daysAgo(7),    expired: 1 },
    { sender: a, recipient: b, amount: 6600,  status: STATUS.cancelled, note: 'Team dinner',                  created_at: daysAgo(3),  expires_at: daysFromNow(4) },
    // b → a
    { sender: b, recipient: a, amount: 6000,  status: STATUS.pending,   note: 'Dinner at Osteria',            created_at: daysAgo(1),  expires_at: daysFromNow(6) },
    { sender: b, recipient: a, amount: 2500,  status: STATUS.paid,      note: 'Parking — LAX',                created_at: daysAgo(7),  expires_at: daysFromNow(0) },
    { sender: b, recipient: a, amount: 18500, status: STATUS.pending,   note: 'Shared Hulu + Netflix',        created_at: daysAgo(0),  expires_at: daysFromNow(7) },
    { sender: b, recipient: a, amount: 5000,  status: STATUS.declined,  note: 'Book club drinks',             created_at: daysAgo(4),  expires_at: daysAgo(1) },
    { sender: b, recipient: a, amount: 11000, status: STATUS.paid,      note: 'Grocery run',                  created_at: daysAgo(9),  expires_at: daysAgo(2) },
    { sender: b, recipient: a, amount: 8800,  status: STATUS.expired,   note: 'Camping gear split',           created_at: daysAgo(15), expires_at: daysAgo(8),    expired: 1 },
    { sender: b, recipient: a, amount: 3300,  status: STATUS.cancelled, note: 'Museum tickets',               created_at: daysAgo(2),  expires_at: daysFromNow(5) },
  ];
}

async function ensureUser(u) {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((x) => x.email === u.email);
  let id;
  if (existing) {
    id = existing.id;
    await supabase.auth.admin.updateUserById(id, { password: PASSWORD, email_confirm: true });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }
  await supabase.from('users').upsert({
    id, email: u.email,
    first_name: u.first_name, last_name: u.last_name,
    balance: u.balance,
  });
  return { ...u, id };
}

async function clearDemoRequests(userIds) {
  await supabase.from('payment_transactions').delete().in('from_user_id', userIds);
  await supabase.from('payment_requests').delete().in('sender_id', userIds);
}

async function createRequests(users) {
  const [sarah, michael, david] = users;

  // 10 extra pending requests per user (incoming from the other two, alternating)
  const EXTRA_PENDING_NOTES = [
    'Rooftop party supplies',     'Half the Uber Pool',
    'Sushi night',                'Museum membership split',
    'Shared iCloud storage',      'Dog sitting — long weekend',
    'Brunch — Sunday',            'Movie tickets + popcorn',
    'Gym guest pass',             'Birthday cake',
    'Wine tasting tickets',       'Cooking class',
    'Beach bonfire supplies',     'Picnic basket',
    'Co-working day pass',        'Escape room',
    'Plant for the office',       'Book swap',
    'Snack run',                  'Fancy coffee',
    'Half the protein powder',    'Weekend parking spot',
    'Shared magazine sub',        'Charity run entry fee',
    'Ice cream run',              'Photo print order',
    'Bowling night',              'Half of the gift card',
    'Ferry tickets',              'Smoothie subscription',
  ];

  const extraPending = [];
  const others = { [sarah.id]: [michael, david], [michael.id]: [sarah, david], [david.id]: [sarah, michael] };
  [sarah, michael, david].forEach((recipient, ui) => {
    for (let k = 0; k < 10; k++) {
      const sender = others[recipient.id][k % 2];
      extraPending.push({
        sender,
        recipient,
        amount: 500 + Math.floor(Math.random() * 24500),
        status: STATUS.pending,
        note: EXTRA_PENDING_NOTES[ui * 10 + k],
        created_at: daysAgo(k),
        expires_at: daysFromNow(7 - (k % 5)),
      });
    }
  });

  const specs = [
    ...buildPairRequests(sarah, michael),
    ...buildPairRequests(sarah, david),
    ...buildPairRequests(michael, david),
    ...extraPending,
  ];

  const rows = specs.map((s) => ({
    sender_id:              s.sender.id,
    recipient_id:           s.recipient.id,
    recipient_email:        s.recipient.email,
    amount:                 s.amount,
    status:                 s.status,
    note:                   s.note,
    created_at:             s.created_at,
    expires_at:             s.expires_at,
    ...(s.scheduled_payment_date ? { scheduled_payment_date: s.scheduled_payment_date } : {}),
    expired: s.expired ?? 0,
  }));

  const { data: inserted, error } = await supabase.from('payment_requests').insert(rows).select();
  if (error) throw error;

  const tx = inserted
    .filter((r) => r.status === STATUS.paid)
    .map((r) => ({
      request_id:       r.id,
      from_user_id:     r.recipient_id,
      to_user_id:       r.sender_id,
      amount:           r.amount,
      transaction_type: 'manual_pay',
      status:           'success',
      paid_at:          r.created_at,
    }));

  if (tx.length) {
    const { error: txErr } = await supabase.from('payment_transactions').insert(tx);
    if (txErr) throw txErr;
  }

  return { requests: inserted.length, transactions: tx.length };
}

async function main() {
  console.log('→ Creating demo users…');
  const users = [];
  for (const u of DEMO_USERS) users.push(await ensureUser(u));
  users.forEach((u) => console.log(`   ${u.email} (${u.id})`));

  console.log('→ Clearing previous demo requests…');
  await clearDemoRequests(users.map((u) => u.id));

  console.log('→ Creating payment requests…');
  const { requests, transactions } = await createRequests(users);
  console.log(`✓ Seeded ${requests} requests (${transactions} transactions) across ${users.length} users.`);
  console.log(`  Statuses: pending, paid, declined, scheduled, expired, cancelled`);
  console.log(`  Login: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
  console.log(`  Password: "${PASSWORD}"`);
}

main().catch((err) => { console.error(err); process.exit(1); });
