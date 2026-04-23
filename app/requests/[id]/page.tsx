'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';

type Party = { first_name: string; last_name: string; email: string } | null;

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
  scheduled_payment_date: string | null;
  expired: number;
  repeated: number;
  failure_reason: string | null;
  sender: Party;
  recipient: Party;
};

type Me = { id: string; email: string; first_name: string; last_name: string; balance: number };

type AnonPreview = {
  id: string;
  amount: number;
  status: number;
  expires_at: string;
  sender_name: string;
  recipient_email: string;
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

const fmtUSD = (c: number) =>
  (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function useCountdown(iso: string) {
  const calc = (target: string) => {
    if (!target) return null;
    const ts = new Date(target).getTime();
    if (isNaN(ts)) return null;
    const diff = ts - Date.now();
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { d, h, m };
  };
  const [val, setVal] = useState(() => calc(iso));
  useEffect(() => {
    setVal(calc(iso));
    const id = setInterval(() => setVal(calc(iso)), 60000);
    return () => clearInterval(id);
  }, [iso]);
  return val;
}

const displayName = (p: Party, fallback: string) =>
  p ? `${p.first_name} ${p.last_name}` : fallback;

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [req, setReq] = useState<PaymentRequest | null>(null);
  const [anon, setAnon] = useState<AnonPreview | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const uRes = await fetch('/api/auth/user', { credentials: 'include' });
      if (!uRes.ok) {
        // Anonymous viewer — show public preview with sign-in / sign-up CTAs.
        const pRes = await fetch(`/api/payment-requests/${id}/preview`);
        if (pRes.ok) setAnon(await pRes.json());
        setLoading(false);
        return;
      }
      const meData = await uRes.json();
      setMe(meData);

      const rRes = await fetch(`/api/payment-requests/${id}`, { credentials: 'include' });
      if (rRes.status === 403) {
        // Authenticated but neither sender nor recipient — fall back to preview.
        const pRes = await fetch(`/api/payment-requests/${id}/preview`);
        if (pRes.ok) setAnon(await pRes.json());
        setForbidden(true);
      } else if (rRes.ok) {
        setReq(await rRes.json());
      }
      setLoading(false);
    })();
  }, [id, router]);

  const act = async (endpoint: string, body?: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/payment-requests/${id}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.error?.details?.[0];
        throw new Error(
          detail ? `${detail.field}: ${detail.issue}` : data.error?.message ?? 'Action failed.'
        );
      }
      if (endpoint === 'pay') {
        // spec: show loading state for 2-3 seconds before success confirmation
        await new Promise((r) => setTimeout(r, 2500));
        setReq((prev) => (prev ? { ...prev, ...data } : data));
        setPaySuccess(true);
        return;
      }
      if (endpoint === 'repeat') {
        router.push(`/requests/${data.id}`);
        return;
      }
      setReq((prev) => (prev ? { ...prev, ...data } : data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error.');
    } finally {
      setBusy(false);
    }
  };

  const countdown = useCountdown(req?.expires_at ?? '');

  if (loading) {
    return (
      <Shell user={me}>
        <div className="max-w-3xl mx-auto p-10 flex justify-center"><img src="/lovie-logo.png" alt="Loading" width={48} height={48} className="lovie-loading" /></div>
      </Shell>
    );
  }

  // Anonymous or forbidden-authenticated viewer: show a public preview with
  // sign-in / sign-up CTAs (Wise-style "Sarah requested $X from you").
  if (anon && !req) {
    const status = STATUS[anon.status] ?? { label: 'Unknown', chip: 'chip-expired' };
    const redirectParam = `redirect=${encodeURIComponent(`/requests/${anon.id}`)}`;
    const emailParam = anon.recipient_email ? `&email=${encodeURIComponent(anon.recipient_email)}` : '';
    const loginHref = `/auth/login?${redirectParam}${emailParam}`;
    const signupHref = `/auth/signup?${redirectParam}${emailParam}`;
    return (
      <div className="min-h-screen grid place-items-center px-6 bg-[var(--color-cream)]">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-brand)] grid place-items-center mx-auto mb-5">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div className={`chip ${status.chip} mb-4`}>{status.label}</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            {anon.sender_name} requested
          </h1>
          <div className="text-5xl font-bold text-[var(--color-ink)] my-3 tracking-tight">
            {fmtUSD(anon.amount)}
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            {forbidden
              ? "You don't have access to this request. Sign in with the recipient account to view."
              : 'Sign in or create a free account to pay, decline, or schedule this request.'}
          </p>
          {anon.recipient_email && (
            <p className="text-xs text-[var(--color-muted)] mt-3">
              Sent to <span className="font-medium text-[var(--color-ink)]">{anon.recipient_email}</span>
            </p>
          )}
          <div className="flex gap-3 mt-6 justify-center">
            <Link href={loginHref} className="btn-brand flex-1">Sign in</Link>
            <Link href={signupHref} className="btn-ghost flex-1">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!req) {
    return (
      <Shell user={me}>
        <div className="max-w-3xl mx-auto p-10 text-center">
          <div className="text-sm text-[var(--color-muted)]">Request not found.</div>
          <Link href="/" className="btn-brand inline-block mt-4 text-sm">
            Back to dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  const isSender = me?.id === req.sender_id;
  const isRecipient =
    me?.id === req.recipient_id || me?.email === req.recipient_email;
  const s = STATUS[req.status] ?? STATUS[1];
  // A request may still be status=1 (pending) but past its expiration if the
  // hourly cron hasn't flipped it yet. Treat it as expired client-side so we
  // don't surface Pay/Decline/Schedule buttons that the server will reject.
  const isEffectivelyExpired =
    req.expired === 1 || new Date(req.expires_at) < new Date();

  const senderName = displayName(req.sender, 'Unknown');
  const recipientName = displayName(req.recipient, req.recipient_email);

  return (
    <Shell user={me}>
      {busy && !paySuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <img src="/lovie-logo.png" alt="Processing" width={72} height={72} className="lovie-loading" />
        </div>
      )}
      {paySuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">✓</div>
            <div className="text-xl font-semibold text-[var(--color-ink)]">Payment successful!</div>
            <div className="text-sm text-[var(--color-muted)] text-center">
              {fmtUSD(req.amount)} has been sent to {displayName(req.sender, 'the requester')}.
            </div>
            <button
              onClick={() => setPaySuccess(false)}
              className="btn-brand w-full mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← Back to dashboard
        </Link>

        <div className="card mt-4 overflow-hidden">
          {/* Summary */}
          <div className="p-8 border-b border-[var(--color-line)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">
                  {isSender ? 'You requested' : `${senderName} requested`}
                </div>
                <div className="text-4xl font-semibold tracking-tight mt-1 tabular-nums">
                  {fmtUSD(req.amount)}
                </div>
                {req.note && (
                  <p className="mt-3 text-[var(--color-ink-3)] italic">“{req.note}”</p>
                )}
              </div>
              <span className={`chip ${s.chip}`}>{s.label}</span>
            </div>

            {req.status === 7 && req.failure_reason && (
              <div className="mt-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] bg-[color:#fff1f2] text-[#be123c] border border-rose-100">
                Failure reason: {req.failure_reason}
              </div>
            )}
            {req.status === 5 && req.scheduled_payment_date && (
              <div className="mt-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] bg-blue-50 text-blue-700 border border-blue-100">
                Scheduled to run on {fmtDateTime(req.scheduled_payment_date)}
              </div>
            )}
          </div>

          {/* Parties + meta */}
          <div className="p-8 grid sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">
                From (requester)
              </div>
              <div className="mt-1 font-medium">{senderName}</div>
              <div className="text-sm text-[var(--color-muted)]">{req.sender?.email ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">
                To (payer)
              </div>
              <div className="mt-1 font-medium">{recipientName}</div>
              {recipientName !== req.recipient_email && (
                <div className="text-sm text-[var(--color-muted)]">{req.recipient_email}</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">
                Created
              </div>
              <div className="mt-1 text-sm">{fmtDateTime(req.created_at)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">
                Expires
              </div>
              <div className="mt-1 text-sm">{fmtDateTime(req.expires_at)}</div>
              {req.status === 1 && (
                <div className="mt-1">
                  {countdown ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M5 2.5V5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      {countdown.d > 0 && `${countdown.d}d `}{countdown.h}h {countdown.m}m left
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 border border-red-200 rounded-full px-2.5 py-0.5">
                      Expired
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-8 border-t border-[var(--color-line)] bg-[var(--color-bg)]">
            {error && (
              <div className="mb-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] bg-red-50 text-red-700 border border-red-100">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              {isRecipient && req.status === 1 && !isEffectivelyExpired && (
                <>
                  <button onClick={() => act('pay')} disabled={busy} className="btn-brand" style={{ minWidth: '7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    {busy ? <><img src="/lovie-logo.png" width={18} height={18} className="lovie-loading" alt="" />Processing…</> : 'Pay now'}
                  </button>
                  <button onClick={() => act('decline')} disabled={busy} className="btn-danger">
                    Decline
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="input text-sm py-1.5"
                      max={new Date(req.expires_at).toISOString().slice(0, 10)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                    <button
                      onClick={() =>
                        scheduleDate &&
                        act('schedule', {
                          scheduled_payment_date: new Date(scheduleDate).toISOString(),
                        })
                      }
                      disabled={busy || !scheduleDate}
                      className="btn-ghost"
                    >
                      Schedule
                    </button>
                  </div>
                </>
              )}

              {isSender && req.status === 1 && !isEffectivelyExpired && (
                <button onClick={() => act('cancel')} disabled={busy} className="btn-danger">
                  Cancel request
                </button>
              )}

              {req.status === 1 && isEffectivelyExpired && (
                <div className="text-sm text-[var(--color-muted)]">
                  This request has expired and can no longer be paid, declined, or cancelled.
                </div>
              )}

              {isSender && (req.status === 3 || req.status === 7) && req.repeated === 0 && (
                <button onClick={() => act('repeat')} disabled={busy} className="btn-brand">
                  Request again (one-time)
                </button>
              )}

              {isRecipient && req.status === 7 && (
                <>
                  <button
                    onClick={() => act('retry', { action: 'pay_now' })}
                    disabled={busy}
                    className="btn-brand"
                  >
                    Retry payment
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="input text-sm py-1.5"
                      max={new Date(req.expires_at).toISOString().slice(0, 10)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                    <button
                      onClick={() =>
                        scheduleDate &&
                        act('retry', {
                          action: 'reschedule',
                          scheduled_payment_date: new Date(scheduleDate).toISOString(),
                        })
                      }
                      disabled={busy || !scheduleDate}
                      className="btn-ghost"
                    >
                      Reschedule
                    </button>
                  </div>
                </>
              )}

              {![1, 3, 7].includes(req.status) && (
                <div className="text-sm text-[var(--color-muted)]">
                  No actions available for this status.
                </div>
              )}
            </div>

            <div className="mt-6 text-xs text-[var(--color-muted)]">
              Request ID: <span className="font-mono">{req.id}</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
