'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RequestDetail() {
  const params = useParams();
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const id = params.id as string;

  useEffect(() => {
    if (!id) return;

    const loadRequest = async () => {
      try {
        const res = await fetch(`/api/payment-requests/${id}`, { credentials: 'include' });
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to load request');
        }
        const data = await res.json();
        setRequest(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading request');
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [id, router]);

  const handleAction = async (action: string, body?: Record<string, any>) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/payment-requests/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to ${action}`);
      }

      const updated = await res.json();
      setRequest(updated);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error: ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' +
           new Date(dateString).toLocaleTimeString();
  };

  const getTimeLeft = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status] || 'bg-gray-100'}`}>
        {statuses[status] || 'Unknown'}
      </span>
    );
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto p-4 text-center">Loading...</div>;
  }

  if (!request) {
    return <div className="max-w-2xl mx-auto p-4 text-center">Request not found</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <button
        onClick={() => router.push('/')}
        className="mb-4 text-blue-600 hover:text-blue-800"
      >
        ← Back to Dashboard
      </button>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">${(request.amount / 100).toFixed(2)}</h1>
            {request.note && <p className="text-gray-600 mt-2">{request.note}</p>}
          </div>
          {statusBadge(request.status)}
        </div>

        <div className="border-t pt-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-gray-600 text-sm">From</p>
              <p className="font-medium">{request.sender_id}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">To</p>
              <p className="font-medium">{request.recipient_email}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Created</p>
              <p className="font-medium text-sm">{formatDate(request.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Expires In</p>
              <p className="font-medium">{getTimeLeft(request.expires_at)}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            {/* Recipient Actions */}
            {request.status === 1 && (
              <>
                <button
                  onClick={() => handleAction('pay')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Pay Now'}
                </button>
                <button
                  onClick={() => handleAction('decline')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Decline'}
                </button>
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() + 3);
                    handleAction('schedule', {
                      scheduled_payment_date: date.toISOString(),
                    });
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Schedule Payment'}
                </button>
              </>
            )}

            {/* Sender Actions */}
            {request.status === 1 && (
              <button
                onClick={() => handleAction('cancel')}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Cancel'}
              </button>
            )}

            {/* Decline & Repeat */}
            {request.status === 3 && request.repeated === 0 && (
              <button
                onClick={() => handleAction('repeat')}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Request Again'}
              </button>
            )}

            {/* Failed Payment Retry */}
            {request.status === 7 && (
              <>
                <button
                  onClick={() => handleAction('retry', { action: 'pay_now' })}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Pay Now'}
                </button>
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() + 3);
                    handleAction('retry', {
                      action: 'reschedule',
                      scheduled_payment_date: date.toISOString(),
                    });
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Reschedule'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
