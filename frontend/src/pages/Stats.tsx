// src/pages/Stats.tsx
//
// NOTE: stat numbers use m-0 explicitly on the <p> tags — see the
// chat explanation for why that's needed even with flex+gap spacing.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileStack,
  XCircle,
} from 'lucide-react';

import { DashboardStats } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { ApiService } from '../services/api';

const Stats = () => {

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await ApiService.getDashboard();
      setStats(data);
    } catch (err: any) {
      setError(
        err?.detail ||
        err?.message ||
        'Terjadi kesalahan saat memuat dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <LoadingSpinner size="lg" text="Memuat dashboard..." />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchStats} />;
  }

  if (!stats) return null;

  const pendingRequests = stats.recent_requests.filter(
    (request) => request.status === 'pending'
  );

  // Color now lives on the card's top edge only — icons stay neutral
  // so status color isn't said twice (once by the icon, once by the
  // border). Total Permohonan keeps the navy brand accent as the
  // one signature card; the other three carry their own status hue.
  const statCards = [
    {
      label: 'Total Permohonan',
      value: stats.total_requests,
      icon: FileStack,
      topBorder: 'border-t-slate-900',
    },
    {
      label: 'Menunggu',
      value: stats.status_counts.pending || 0,
      icon: Clock3,
      topBorder: 'border-t-amber-400',
    },
    {
      label: 'Selesai',
      value: stats.status_counts.completed || 0,
      icon: CheckCircle2,
      topBorder: 'border-t-emerald-400',
    },
    {
      label: 'Ditolak',
      value: stats.status_counts.rejected || 0,
      icon: XCircle,
      topBorder: 'border-t-rose-400',
    },
  ];

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  // Deterministic initials + a small color set so avatars stay
  // consistent across reloads without needing a real image.
  const avatarPalette = [
    'bg-slate-900/5 text-slate-900',
    'bg-indigo-50 text-indigo-600',
    'bg-teal-50 text-teal-600',
    'bg-sky-50 text-sky-600',
    'bg-violet-50 text-violet-600',
  ];

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  const getAvatarStyle = (name: string) => {
    const index = name
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatarPalette[index % avatarPalette.length];
  };

  return (
    <div className="space-y-5">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className={`
                flex flex-col gap-2.5
                rounded-xl border border-slate-200 border-t-2 bg-white
                px-5 py-4
                shadow-[0_1px_2px_rgba(15,23,42,0.04)]
                transition hover:border-slate-300 hover:shadow-sm
                ${item.topBorder}
              `}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-900/5">
                <Icon size={18} strokeWidth={2} />
              </div>

              <div className="flex flex-col gap-1">
                <p className="m-0 text-[32px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
                  {item.value}
                </p>

                <p className="m-0 text-[13px] font-medium leading-none text-slate-500">
                  {item.label}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pending requests */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              Permohonan Menunggu
            </h2>

            <p className="mt-1 text-[13px] text-slate-500">
              Permohonan terbaru yang perlu ditinjau.
            </p>
          </div>

          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-50 px-2 text-xs font-semibold text-amber-700">
            {pendingRequests.length}
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={21} strokeWidth={1.8} />
            </div>

            <p className="mt-3 text-sm font-medium text-slate-700">
              Tidak ada permohonan yang menunggu
            </p>

            <p className="mt-1 text-[13px] text-slate-400">
              Seluruh permohonan telah ditinjau.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Mahasiswa
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Jenis surat
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Tanggal
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pendingRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${getAvatarStyle(
                            request.student_name
                          )}`}
                        >
                          {getInitials(request.student_name)}
                        </span>

                        <p className="text-[13px] font-medium text-slate-900">
                          {request.student_name}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-slate-600">
                      {request.template_name}
                    </td>

                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-slate-500">
                      {formatDate(request.created_at)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Menunggu
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/dashboard/requests/${request.id}/process`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Tinjau
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <Link
              to="/dashboard/requests"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 transition hover:text-slate-900"
            >
              Lihat seluruh permohonan
              <ArrowRight size={14} strokeWidth={1.8} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default Stats;