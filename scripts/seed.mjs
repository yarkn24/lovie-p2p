/**
 * Seed 3 demo users (user1 / user2 / user3, password "123") with mock
 * payment requests. Safe to re-run: it wipes demo data first.
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
  { email: 'sarah.demo@lovie.co', first_name: 'Sarah',   last_name: 'Johnson',   balance: 1250000 },
  { email: 'michael.demo@lovie.co', first_name: 'Michael', last_name: 'Rodriguez', balance:  980000 },
  { email: 'david.demo@lovie.co', first_name: 'David',   last_name: 'Chen',      balance: 1540000 },
];
const PASSWORD = '123';

const NOTES_PENDING = [
  'Dinner at Osteria Mozza',
  'Concert tickets — Mitski',
  'Split the Airbnb',
  'Your half of the electric bill',
  'Weekend ski trip',
  'Coffee + croissants',
  'Cab home from the airport',
  'Groceries run',
  'Birthday gift for Sam',
  'Shared spotify family',
];
const NOTES_PAID = [
  'Rent — April',
  'Utilities share',
  'Anniversary dinner',
  'Board game night pizza',
  'Pickleball court',
  'Bachelorette brunch',
  'Team lunch Thursday',
  'Hotel split — NYC',
  'Taxi to JFK',
  'Costco run',
];

const randAmount = () => {
  // $5.00 – $250.00 in cents
  const dollars = 5 + Math.floor(Math.random() * 246);
  const cents = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 100);
  return dollars * 100 + cents;
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

async function ensureUser(u) {
  // Look up existing by email
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((x) => x.email === u.email);
  let id;
  if (existing) {
    id = existing.id;
    await supabase.auth.admin.updateUserById(id, { password: PASSWORD, email_confirm: true });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }
  await supabase.from('users').upsert({
    id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    balance: u.balance,
  });
  return { ...u, id };
}

async function clearDemoRequests(userIds) {
  await supabase.from('payment_transactions').delete().in('from_user_id', userIds);
  await supabase.from('payment_requests').delete().in('sender_id', userIds);
}

async function createRequests(users) {
  const rows = [];
  const tx = [];

  for (let i = 0; i < users.length; i++) {
    const me = users[i];
    const others = users.filter((_, j) => j !== i);

    // 5 incoming pending (others requested from me)
    for (let k = 0; k < 5; k++) {
      const from = others[k % others.length];
      const amt = randAmount();
      rows.push({
        sender_id: from.id,
        recipient_id: me.id,
        recipient_email: me.email,
        amount: amt,
        status: 1,
        expires_at: daysFromNow(7 - k),
        note: NOTES_PENDING[(i * 5 + k) % NOTES_PENDING.length],
        created_at: daysAgo(k),
      });
    }

    // 5 outgoing paid (I requested from others, they paid)
    for (let k = 0; k < 5; k++) {
      const to = others[k % others.length];
      const amt = randAmount();
      rows.push({
        sender_id: me.id,
        recipient_id: to.id,
        recipient_email: to.email,
        amount: amt,
        status: 2,
        expires_at: daysFromNow(7 - k),
        note: NOTES_PAID[(i * 5 + k) % NOTES_PAID.length],
        created_at: daysAgo(k + 2),
      });
    }
  }

  const { data: inserted, error } = await supabase
    .from('payment_requests')
    .insert(rows)
    .select();
  if (error) throw error;

  for (const r of inserted) {
    if (r.status === 2) {
      tx.push({
        request_id: r.id,
        from_user_id: r.recipient_id,
        to_user_id: r.sender_id,
        amount: r.amount,
        transaction_type: 'manual_pay',
        status: 'success',
        paid_at: r.created_at,
      });
    }
  }
  if (tx.length) {
    const { error: txErr } = await supabase.from('payment_transactions').insert(tx);
    if (txErr) throw txErr;
  }
  return inserted.length;
}

async function main() {
  console.log('→ Creating demo users…');
  const users = [];
  for (const u of DEMO_USERS) users.push(await ensureUser(u));
  users.forEach((u) => console.log(`   ${u.email} (${u.id})`));

  console.log('→ Clearing previous demo requests…');
  await clearDemoRequests(users.map((u) => u.id));

  console.log('→ Creating payment requests…');
  const n = await createRequests(users);
  console.log(`✓ Seeded ${n} payment requests across ${users.length} users.`);
  console.log(`  Login with any of: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
  console.log(`  Password: "${PASSWORD}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
