'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Dashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (!res.ok) {
        router.push('/auth/login');
        return;
      }
      loadData();
    };
    checkAuth();
  }, [router, tab]);

  const loadData = async () => {
    try {
      const [reqRes, balRes] = await Promise.all([
        fetch(`/api/payment-requests?direction=${tab}`, { credentials: 'include' }),
        fetch('/api/user/balance', { credentials: 'include' }),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data || []);
      }

      if (balRes.ok) {
        const { balance } = await balRes.json();
        setBalance(balance);
      }
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: number) => {
    const statuses: Record<number, string> = {
      1: 'Pending',
      2: 'Paid',
      3: 'Declined',
      4: 'Expired',
      5: 'Scheduled',
      6: 'Cancelled',
      7: 'Failed',
    };
    const colors: Record<number, string> = {
      1: 'bg-yellow-100 text-yellow-800',
      2: 'bg-green-100 text-green-800',
      3: 'bg-red-100 text-red-800',
      4: 'bg-gray-100 text-gray-800',
      5: 'bg-blue-100 text-blue-800',
      6: 'bg-gray-100 text-gray-800',
      7: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-sm ${colors[status] || 'bg-gray-100'}`}>
        {statuses[status] || 'Unknown'}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Lovie P2P</h1>
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Balance</p>
            <p className="text-2xl font-bold">${(balance / 100).toFixed(2)}</p>
          </div>
          <button
            onClick={() => router.push('/auth/logout')}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Create Button */}
      <div className="mb-6">
        <Link
          href="/requests/new"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Request
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setTab('incoming')}
          className={`px-4 py-2 font-medium ${
            tab === 'incoming'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Incoming Requests
        </button>
        <button
          onClick={() => setTab('outgoing')}
          className={`px-4 py-2 font-medium ${
            tab === 'outgoing'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Outgoing Requests
        </button>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No {tab} requests
          </div>
        ) : (
          <div className="divide-y">
            {requests.map((req) => (
              <Link
                key={req.id}
                href={`/requests/${req.id}`}
                className="p-4 hover:bg-gray-50 transition block"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-medium">
                      ${(req.amount / 100).toFixed(2)}
                    </p>
                    {req.note && <p className="text-gray-600 text-sm">{req.note}</p>}
                    <p className="text-gray-500 text-sm">
                      {tab === 'incoming'
                        ? `From ${req.sender_id}`
                        : `To ${req.recipient_email}`}
                    </p>
                  </div>
                  {statusBadge(req.status)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
