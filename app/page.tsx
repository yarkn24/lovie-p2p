'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Shell from '@/components/Shell';
import { getAvatar } from '@/lib/avatars';

type PaymentRequest = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  recipient_email: string;
  amount: number;
  status: number;
  note: string | null;
  expires_at: string;
  created_at: string;
  sender?: { first_name: string; last_name: string; email: string } | null;
  recipient?: { first_name: string; last_name: string; email: string } | null;
};

type Me = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  balance: number;
};

const STATUS: Record<number, { label: string; chip: string }> = {
  1: { label: 'Pending', chip: 'chip-pending' },
  2: { label: 'Paid', chip: 'chip-paid' },
  3: { label: 'Declined', chip: 'chip-declined' },
  4: { label: 'Expired', chip: 'chip-expired' },
  5: { label: 'Scheduled', chip: 'chip-scheduled' },
  6: { label: 'Cancelled', chip: 'chip-cancelled' },
  7: { label: 'Failed', chip: 'chip-failed' },
};

const fmtUSD = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [filter, setFilter] = useState<'all' | 'pending' | 'scheduled' | 'paid' | 'declined' | 'expired' | 'cancelled' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const router = useRouter();

  const adjustBalance = async (action: 'add' | 'subtract') => {
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) return;
    setAdjusting(true);
    const res = await fetch('/api/user/balance', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, amount }),
    });
    if (res.ok) {
      const { balance } = await res.json();
      setMe((prev) => (prev ? { ...prev, balance } : prev));
      setAdjustAmount('');
    }
    setAdjusting(false);
  };

  useEffect(() => {
    (async () => {
      const userRes = await fetch('/api/auth/user', { credentials: 'include' });
      if (!userRes.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userRes.json();
      setMe(userData);
    })();
  }, [router]);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    fetch(`/api/payment-requests?direction=${tab}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [tab, me]);

  const filtered = useMemo(() => {
    return requests
      .filter((r) => {
        if (filter === 'pending') return r.status === 1;
        if (filter === 'scheduled') return r.status === 5;
        if (filter === 'paid') return r.status === 2;
        if (filter === 'declined') return r.status === 3;
        if (filter === 'expired') return r.status === 4;
        if (filter === 'cancelled') return r.status === 6;
        if (filter === 'failed') return r.status === 7;
        return true;
      })
      .filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const counterparty =
          tab === 'incoming'
            ? `${r.sender?.first_name ?? ''} ${r.sender?.last_name ?? ''} ${r.sender?.email ?? ''}`
            : `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''} ${r.recipient_email}`;
        return (
          counterparty.toLowerCase().includes(q) ||
          (r.note ?? '').toLowerCase().includes(q)
        );
      });
  }, [requests, filter, search, tab]);

  const summary = useMemo(() => {
    const pending = requests.filter((r) => r.status === 1 || r.status === 5);
    const paid = requests.filter((r) => r.status === 2);
    const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
    const paidTotal = paid.reduce((s, r) => s + r.amount, 0);
    return {
      pendingCount: pending.length,
      pendingTotal,
      paidCount: paid.length,
      paidTotal,
    };
  }, [requests]);

  return (
    <Shell user={me}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="card md:col-span-2 p-6 border-transparent"
            style={{ background: 'linear-gradient(135deg, #0546bf 0%, #065b98 100%)', color: 'white' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Available balance
            </div>
            <div style={{ fontSize: '2.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {me ? fmtUSD(me.balance) : <span style={{ opacity: 0.4 }}>—</span>}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 items-center">
              <Link href="/requests/new"
                style={{ background: 'white', color: '#0546bf', padding: '0.5rem 1rem', borderRadius: '0.625rem', fontWeight: 500, fontSize: '0.875rem' }}>
                + New request
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.625rem', padding: '0.25rem' }}>
                <span style={{ paddingLeft: '0.5rem', opacity: 0.7, fontSize: '0.875rem' }}>$</span>
                <input type="number" step="0.01" min="0" placeholder="0.00"
                  value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)}
                  style={{ background: 'transparent', width: '5rem', fontSize: '0.875rem', color: 'white', outline: 'none' }} />
                <button onClick={() => adjustBalance('add')} disabled={adjusting || !adjustAmount}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.15)', borderRadius: '0.375rem', cursor: 'pointer', color: 'white', opacity: (adjusting || !adjustAmount) ? 0.4 : 1 }}>
                  + Add
                </button>
                <button onClick={() => adjustBalance('subtract')} disabled={adjusting || !adjustAmount}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.15)', borderRadius: '0.375rem', cursor: 'pointer', color: 'white', opacity: (adjusting || !adjustAmount) ? 0.4 : 1 }}>
                  − Sub
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">Pending</div>
              <div className="text-2xl font-semibold mt-1">{summary.pendingCount}</div>
              <div className="text-sm text-[var(--color-muted)] mt-0.5">{fmtUSD(summary.pendingTotal)}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">Completed</div>
              <div className="text-2xl font-semibold mt-1">{summary.paidCount}</div>
              <div className="text-sm text-[var(--color-muted)] mt-0.5">{fmtUSD(summary.paidTotal)}</div>
            </div>
          </div>
        </div>

        {/* Tabs + filters */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
            <div className="flex rounded-[var(--radius-lovie)] bg-white border border-[var(--color-line)] p-0.5">
              <button
                onClick={() => setTab('incoming')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  tab === 'incoming' ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)]'
                }`}
              >
                Incoming
              </button>
              <button
                onClick={() => setTab('outgoing')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  tab === 'outgoing' ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)]'
                }`}
              >
                Outgoing
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="text-sm px-3 py-1.5 rounded-[var(--radius-lovie)] border border-[var(--color-line)] bg-white"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="paid">Paid</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>
              <input
                placeholder="Search name or note…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-[var(--radius-lovie)] border border-[var(--color-line)] bg-white w-48"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[var(--color-muted)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-[var(--color-muted)] text-sm">No {tab} requests match.</div>
              {tab === 'outgoing' && (
                <Link href="/requests/new" className="btn-brand mt-4 inline-block text-sm">
                  Send your first request
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {filtered.map((r) => {
                const counterparty =
                  tab === 'incoming'
                    ? r.sender
                      ? `${r.sender.first_name} ${r.sender.last_name}`
                      : 'Unknown'
                    : r.recipient
                    ? `${r.recipient.first_name} ${r.recipient.last_name}`
                    : r.recipient_email;
                const counterEmail =
                  tab === 'incoming' ? r.sender?.email : r.recipient?.email ?? r.recipient_email;
                const counterAvatar = getAvatar(counterEmail);
                const s = STATUS[r.status] ?? STATUS[1];
                return (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-bg)] transition"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0"
                        style={{ background: 'var(--color-bg-2)', flexShrink: 0 }}>
                        {counterAvatar ? (
                          <Image src={counterAvatar} alt={counterparty} width={40} height={40}
                            className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-sm font-semibold"
                            style={{ color: 'var(--color-ink-2)' }}>
                            {counterparty.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--color-ink)] truncate">
                          {tab === 'incoming' ? `${counterparty} requested from you` : `You requested from ${counterparty}`}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {counterEmail} · {fmtDate(r.created_at)}
                          {r.note ? ` · ${r.note}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold tabular-nums text-[var(--color-ink)]">
                          {fmtUSD(r.amount)}
                        </div>
                        <div className="mt-1">
                          <span className={`chip ${s.chip}`}>{s.label}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
