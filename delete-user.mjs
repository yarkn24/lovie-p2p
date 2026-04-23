const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pat = process.env.SUPABASE_PAT;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// 1. Find user
console.log('Finding user...');
let res = await fetch(`${url}/rest/v1/users?email=ilike.yarkinakcil%40gmail.com`, { headers });
let data = await res.json();
if (!data[0]) {
  console.log('User not found');
  process.exit(0);
}
const userId = data[0].id;
console.log(`Found: ${data[0].email} (${userId})`);

// 2. Delete transactions
console.log('Deleting transactions...');
res = await fetch(
  `${url}/rest/v1/payment_transactions?or=(from_user_id.eq.${userId},to_user_id.eq.${userId})`,
  { method: 'DELETE', headers }
);
data = await res.json();
console.log(`✓ Deleted transactions`);

// 3. Delete requests
console.log('Deleting requests...');
res = await fetch(
  `${url}/rest/v1/payment_requests?or=(sender_id.eq.${userId},recipient_id.eq.${userId})`,
  { method: 'DELETE', headers }
);
data = await res.json();
console.log(`✓ Deleted requests`);

// 4. Delete user record
console.log('Deleting user record...');
res = await fetch(`${url}/rest/v1/users?id=eq.${userId}`, { method: 'DELETE', headers });
console.log(`✓ Deleted user record`);

// 5. Delete from auth
if (!pat) {
  console.warn('⚠ SUPABASE_PAT missing; auth user not deleted. Delete manually.');
  process.exit(0);
}

console.log('Deleting from auth...');
const ref = url.split('.')[0].replace('https://', '');
const mgmtUrl = `https://api.supabase.com/v1/projects/${ref}/auth/users/${userId}`;
res = await fetch(mgmtUrl, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${pat}` },
});
if (!res.ok) {
  const err = await res.text();
  console.error(`Auth delete failed: ${res.status}`, err);
  process.exit(1);
}
console.log(`✓ Deleted from auth`);
console.log('\n✅ Complete: user + all data deleted');
