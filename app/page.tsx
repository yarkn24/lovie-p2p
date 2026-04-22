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
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc' | 'status'>('date-desc');
  const [loading, setLoading] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [confirmState, setConfirmState] = useState<
    | { action: 'pay' | 'decline' | 'schedule'; req: PaymentRequest; scheduleDate: string; dontAsk: boolean }
    | null
  >(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const router = useRouter();

  const skipKey = (action: 'pay' | 'decline' | 'schedule') => `confirm-skip-${action}`;
  const isSkipped = (action: 'pay' | 'decline' | 'schedule') => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(skipKey(action)) === '1';
  };

  const runAction = async (
    action: 'pay' | 'decline' | 'schedule',
    req: PaymentRequest,
    scheduledDate?: string
  ) => {
    setRowBusy(req.id);
    try {
      const body =
        action === 'schedule' && scheduledDate
          ? JSON.stringify({ scheduled_payment_date: new Date(scheduledDate).toISOString() })
          : undefined;
      const res = await fetch(`/api/payment-requests/${req.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error?.message ?? `Failed to ${action}.`);
        return;
      }
      const newStatus = action === 'pay' ? 2 : action === 'decline' ? 3 : 5;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: newStatus } : r
        )
      );
      const meRes = await fetch('/api/auth/user', { credentials: 'include' });
      if (meRes.ok) setMe(await meRes.json());
    } finally {
      setRowBusy(null);
    }
  };

  const handleInlineAction = (
    action: 'pay' | 'decline' | 'schedule',
    req: PaymentRequest,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (action !== 'schedule' && isSkipped(action)) {
      runAction(action, req);
      return;
    }
    setConfirmState({ action, req, scheduleDate: '', dontAsk: false });
  };

  const confirmAndRun = async () => {
    if (!confirmState) return;
    const { action, req, scheduleDate, dontAsk } = confirmState;
    if (action === 'schedule' && !scheduleDate) {
      alert('Please pick a date.');
      return;
    }
    if (dontAsk && action !== 'schedule') {
      localStorage.setItem(skipKey(action), '1');
    }
    setConfirmState(null);
    await runAction(action, req, scheduleDate);
  };

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
    const counterpartyName = (r: PaymentRequest) =>
      tab === 'incoming'
        ? `${r.sender?.first_name ?? ''} ${r.sender?.last_name ?? ''}`.trim()
        : `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`.trim() || r.recipient_email;

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
        const cp = `${counterpartyName(r)} ${tab === 'incoming' ? r.sender?.email ?? '' : r.recipient_email}`;
        return cp.toLowerCase().includes(q) || (r.note ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sort === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sort === 'date-asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc')  return a.amount - b.amount;
        if (sort === 'name-asc') return counterpartyName(a).localeCompare(counterpartyName(b));
        if (sort === 'status') return a.status - b.status;
        return 0;
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
            style={{
              backgroundImage:
                'linear-gradient(130deg, #0a1a6b 0%, #1e40af 25%, #2563eb 50%, #06b6d4 75%, #10b981 100%)',
              backgroundSize: '220% 220%',
              animation: 'balance-shift 18s ease-in-out infinite',
              color: 'white',
              position: 'relative',
            }}>
            <span style={{
              position: 'absolute', bottom: '1rem', right: '1.25rem',
              fontFamily: "'Kaushan Script', cursive",
              fontSize: '1.6rem', opacity: 0.35, pointerEvents: 'none', userSelect: 'none',
            }}>Lovie</span>
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
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="text-sm px-3 py-1.5 rounded-[var(--radius-lovie)] border border-[var(--color-line)] bg-white"
              >
                <option value="date-desc">Date ↓</option>
                <option value="date-asc">Date ↑</option>
                <option value="amount-desc">Amount ↓</option>
                <option value="amount-asc">Amount ↑</option>
                <option value="name-asc">Name A–Z</option>
                <option value="status">Status</option>
              </select>
              <input
                placeholder="Search name or note…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-[var(--radius-lovie)] border border-[var(--color-line)] bg-white w-48"
              />
            </div>
          </div>

          {!loading && filtered.length === 0 ? (
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
                      {tab === 'incoming' && r.status === 1 && (
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <button
                            onClick={(e) => handleInlineAction('pay', r, e)}
                            disabled={rowBusy === r.id}
                            className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--color-line)] bg-[var(--color-ink)] text-white hover:opacity-90 disabled:opacity-40"
                          >
                            Pay
                          </button>
                          <button
                            onClick={(e) => handleInlineAction('schedule', r, e)}
                            disabled={rowBusy === r.id}
                            className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-bg)] disabled:opacity-40"
                          >
                            Schedule
                          </button>
                          <button
                            onClick={(e) => handleInlineAction('decline', r, e)}
                            disabled={rowBusy === r.id}
                            className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-bg)] disabled:opacity-40"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {confirmState && (
        <div
          onClick={() => setConfirmState(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ background: 'white', maxWidth: '24rem', width: '100%', padding: '1.5rem' }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {confirmState.action === 'pay' && 'Pay this request?'}
              {confirmState.action === 'decline' && 'Decline this request?'}
              {confirmState.action === 'schedule' && 'Schedule payment'}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              {confirmState.action === 'pay' &&
                `You're about to send ${fmtUSD(confirmState.req.amount)} to ${
                  confirmState.req.sender
                    ? `${confirmState.req.sender.first_name} ${confirmState.req.sender.last_name}`
                    : 'the sender'
                }.`}
              {confirmState.action === 'decline' &&
                `Decline the ${fmtUSD(confirmState.req.amount)} request? The sender will be notified.`}
              {confirmState.action === 'schedule' &&
                `Pick a future date (on or before ${fmtDate(confirmState.req.expires_at)}) to automatically pay ${fmtUSD(confirmState.req.amount)}.`}
            </div>

            {confirmState.action === 'schedule' && (
              <input
                type="date"
                value={confirmState.scheduleDate}
                min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                max={confirmState.req.expires_at.slice(0, 10)}
                onChange={(e) =>
                  setConfirmState((s) => (s ? { ...s, scheduleDate: e.target.value } : s))
                }
                className="w-full text-sm px-3 py-2 rounded-md border border-[var(--color-line)] bg-white"
                style={{ marginBottom: '0.75rem' }}
              />
            )}

            {confirmState.action !== 'schedule' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={confirmState.dontAsk}
                  onChange={(e) =>
                    setConfirmState((s) => (s ? { ...s, dontAsk: e.target.checked } : s))
                  }
                />
                Don&apos;t show this message again
              </label>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmState(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-line)] bg-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndRun}
                className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-ink)] text-white"
              >
                {confirmState.action === 'pay' && 'Pay now'}
                {confirmState.action === 'decline' && 'Decline'}
                {confirmState.action === 'schedule' && 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
