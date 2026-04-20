'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';

type Me = { id: string; email: string; first_name: string; last_name: string; balance: number };

type ApiError = {
  error?: { message?: string; details?: { field: string; issue: string }[] };
};

export default function NewRequest() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ recipient_email: '', amount: '', note: '' });

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (!res.ok) return router.push('/auth/login');
      setMe(await res.json());
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!form.recipient_email || !form.amount) throw new Error('Email and amount are required.');
      const amt = parseFloat(form.amount);
      if (amt <= 0) throw new Error('Amount must be greater than zero.');
      if (form.note.length > 500) throw new Error('Note must be 500 characters or less.');

      const res = await fetch('/api/payment-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: form.recipient_email,
          amount: amt,
          note: form.note || null,
        }),
      });

      if (!res.ok) {
        const data: ApiError = await res.json();
        const detail = data.error?.details?.[0];
        throw new Error(
          detail
            ? `${detail.field}: ${detail.issue}`
            : data.error?.message ?? 'Failed to create request.'
        );
      }

      const req = await res.json();
      router.push(`/requests/${req.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating request.');
      setLoading(false);
    }
  };

  return (
    <Shell user={me}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← Back to dashboard
        </Link>

        <div className="card mt-4 p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Request payment</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Send a request by email. Recipients have 7 days to pay, decline, or schedule.
          </p>

          {error && (
            <div className="mt-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] bg-red-50 text-red-700 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--color-ink-3)]">Recipient email</label>
              <input
                type="email"
                value={form.recipient_email}
                onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
                placeholder="friend@example.com"
                className="input mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-ink-3)]">Amount (USD)</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="input pl-7"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-ink-3)]">Note (optional)</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                maxLength={500}
                rows={3}
                placeholder="What's this for?"
                className="input mt-1 resize-none"
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">{form.note.length}/500</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-brand flex-1">
                {loading ? 'Creating…' : 'Send request'}
              </button>
              <Link href="/" className="btn-ghost">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </Shell>
  );
}
