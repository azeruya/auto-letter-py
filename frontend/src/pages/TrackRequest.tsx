import { useState } from "react";
import { TrackingResponse } from "../types";
import { ApiService } from "../services/api";

// Same status colors as Requests.tsx — worth eventually sharing one
// statusStyles map (and formatLabel) across files instead of each
// page keeping its own copy.
const statusStyles: Record<
  string,
  { badge: string; dot: string; label: string }
> = {
  pending: {
    badge: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    label: 'Menunggu',
  },
  in_progress: {
    badge: 'bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    label: 'Diproses',
  },
  completed: {
    badge: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Selesai',
  },
  rejected: {
    badge: 'bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    label: 'Ditolak',
  },
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Small label/value pair, same pattern as the Requests/Templates
// details modals, so a scan of this page and a scan of those modals
// look like the same product.
const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-0.5 text-[13px] text-slate-900">{value}</p>
  </div>
);

export default function TrackRequest() {
  const [trackingId, setTrackingId] = useState("");
  const [result, setResult] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!trackingId.trim()) {
      setError("Masukkan Tracking ID terlebih dahulu.");
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await ApiService.trackRequest(trackingId);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal mencari data");
    } finally {
      setLoading(false);
    }
  };

  const status = result ? statusStyles[result.status] || statusStyles.pending : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto mb-8 max-w-xl text-center">
        <img src="/logo.png" alt="Logo" className="mx-auto mb-3 h-16" />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Sistem Administrasi Surat
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Lacak Status Permohonan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Masukkan Tracking ID untuk melihat status permohonan surat Anda.
        </p>
      </div>

      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Masukkan Tracking ID (misal: REQ250923679)"
            value={trackingId}
            disabled={loading}
            onChange={(e) => setTrackingId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="form-input flex-1"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="btn-primary shrink-0 px-5"
          >
            {loading ? "Mencari..." : "Cari"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-[13px] text-rose-600">{error}</p>
        )}
      </div>

      {result && status && (
        <div className="mx-auto mt-5 max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Header: what it is + status, read first */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-base font-semibold text-slate-900">
                {result.template_name}
              </p>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {result.student_name}
              </p>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          {result.status_description && (
            <p className="mt-4 text-[13px] text-slate-600">
              {result.status_description}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Tracking ID" value={result.tracking_id} />
            <Field label="Keperluan" value={result.keperluan} />
            <Field label="Diajukan" value={formatDateTime(result.created_at)} />
            {result.processed_at && (
              <Field label="Diproses" value={formatDateTime(result.processed_at)} />
            )}
            {result.completed_at && (
              <Field label="Selesai" value={formatDateTime(result.completed_at)} />
            )}
            {result.admin_notes && (
              <div className="col-span-2">
                <Field label="Catatan Admin" value={result.admin_notes} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}