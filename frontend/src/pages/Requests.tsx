// src/pages/Requests.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { ApiService } from '../services/api';
import toast from 'react-hot-toast';
import { Modal, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { RequestItem } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

import {
  Eye,
  ArrowRight,
  Check,
  X,
  Download,
  Copy,
} from 'lucide-react';

type FilterValue = 'all' | 'pending' | 'in_progress' | 'completed' | 'rejected';

// Same semantic hues as the dashboard: amber = waiting, emerald = done,
// rose = rejected. in_progress isn't tracked on the dashboard cards, so
// it gets its own lane (sky) rather than borrowing one of those three.
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

const filterTabs: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'in_progress', label: 'Diproses' },
  { value: 'completed', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
];

// Same formatter as StudentTemplateForm.tsx — the modal below shows
// raw student_data/admin_data keys ("nama1", "tanggal_akhir") which
// need the same snake_case → Title Case + acronym handling.
const KNOWN_ACRONYMS = new Set(['nim', 'nip', 'nik', 'ktp', 'kk', 'sks', 'ipk']);

function formatLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (KNOWN_ACRONYMS.has(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Same rotation used on Dashboard's pending-requests table, so a
// student's avatar color stays consistent across both pages.
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

const Requests = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [adminFormSchema, setAdminFormSchema] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState(0);

  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(
    null
  );
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await ApiService.listRequests({
        status: filter === 'all' ? undefined : filter,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });
      setRequests(data.requests);
      setTotalCount(data.total_count);
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || err.message || 'Gagal memuat permohonan'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = (id: string | undefined) => {
    if (!id) {
      toast.error('ID permohonan tidak valid');
      return;
    }
    navigate(`/dashboard/requests/${id}/process`);
  };

  const handleGenerate = async (id: string) => {
    try {
      const result = await ApiService.generateRequest(id);
      toast.success('Permohonan selesai & dokumen dibuat');

      if (result.generated_documents?.length) {
        result.generated_documents.forEach((doc: any) => {
          // auto-download each file
          ApiService.downloadDocument(doc.id);
        });
      }

      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal membuat dokumen');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Masukkan alasan penolakan:');
    if (!reason) return;
    try {
      await ApiService.rejectRequest(id, reason);
      toast.success('Permohonan ditolak');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal menolak permohonan');
    }
  };

  const handleView = async (id: string) => {
    try {
      const details = await ApiService.getRequestDetails(id);
      setSelectedRequest(details.request);
      setAdminFormSchema(details.admin_form_schema);
      setDetailsModalVisible(true);
    } catch (error) {
      message.error('Gagal memuat detail permohonan');
    }
  };

  const handleExportAll = async () => {
    try {
      const blob = await ApiService.exportRequests();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'requests.xlsx');
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error('Gagal mengekspor permohonan');
    }
  };

  const handleExportSelected = async () => {
    try {
      const ids = requests.map((r) => r.id);
      const blob = await ApiService.exportDetailedRequests(ids);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'requests_detailed.xlsx');
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error('Gagal mengekspor detail permohonan');
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="space-y-5">
      {/* Filter tabs + export actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Segmented tab control, same pattern as HRISELink's
            Requested/Balances/Calendar switcher: light track,
            white active pill with a soft shadow. */}
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setFilter(tab.value);
                setCurrentPage(1);
              }}
              className={`
                rounded-md px-3.5 py-1.5 text-[13px] font-medium transition
                ${
                  filter === tab.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportSelected}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ekspor Detail
          </button>

          <button
            type="button"
            onClick={handleExportAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
          >
            Ekspor Semua
          </button>
        </div>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <LoadingSpinner size="lg" text="Memuat permohonan..." />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">
              Tidak ada permohonan
            </p>
            <p className="mt-1 text-[13px] text-slate-400">
              Belum ada permohonan untuk filter ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Mahasiswa
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Jenis Surat
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Tanggal Dibuat
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const status =
                    statusStyles[r.status] || statusStyles.pending;

                  return (
                    <tr
                      key={r.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${getAvatarStyle(
                              r.student.nama
                            )}`}
                          >
                            {getInitials(r.student.nama)}
                          </span>

                          <p className="text-[13px] font-medium text-slate-900">
                            {r.student.nama}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-[13px] text-slate-600">
                        {r.template.name}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                          />
                          {status.label}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-slate-500">
                        {formatDate(r.created_at)}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Lihat"
                            onClick={() => handleView(r.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <Eye size={14} strokeWidth={1.8} />
                          </button>

                          {r.status === 'pending' && (
                            <button
                              type="button"
                              title="Proses"
                              onClick={() => handleProcess(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <ArrowRight size={14} strokeWidth={1.8} />
                            </button>
                          )}

                          {r.status === 'in_progress' && (
                            <button
                              type="button"
                              title="Buat Dokumen"
                              onClick={() => handleGenerate(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800"
                            >
                              <Check size={14} strokeWidth={1.8} />
                            </button>
                          )}

                          {['pending', 'in_progress'].includes(r.status) && (
                            <button
                              type="button"
                              title="Tolak"
                              onClick={() => handleReject(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                            >
                              <X size={14} strokeWidth={1.8} />
                            </button>
                          )}

                          {r.status === 'completed' &&
                            r.generated_documents?.map((doc: any) => (
                              <button
                                key={doc.id}
                                type="button"
                                title={`Unduh ${doc.format?.toUpperCase() || 'File'}`}
                                onClick={() =>
                                  ApiService.downloadDocument(doc.id)
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50"
                              >
                                <Download size={14} strokeWidth={1.8} />
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && requests.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <p className="text-[13px] text-slate-500">
              Halaman {currentPage} dari {totalPages}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white"
              >
                Sebelumnya
              </button>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Details Modal */}
      <Modal
        title={
          <span className="text-[15px] font-semibold text-slate-900">
            Detail Permohonan
          </span>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
        width={640}
        centered
      >
        {selectedRequest ? (
          (() => {
            const status =
              statusStyles[selectedRequest.status] || statusStyles.pending;

            const copyToClipboard = (value: string, label: string) => {
              navigator.clipboard.writeText(value);
              toast.success(`${label} disalin`);
            };

            // Reusable label/value pair so every field in this modal —
            // core info, student data, admin data — renders identically
            // instead of three different ad hoc formats.
            const Field = ({
              label,
              value,
            }: {
              label: string;
              value: ReactNode;
            }) => (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-900">{value}</p>
              </div>
            );

            return (
              <div className="space-y-5">
                {/* Header: letter type + status, the two things an
                    admin scans for first */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {selectedRequest.template.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {selectedRequest.student.nama} (
                      {selectedRequest.student.nim})
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {/* Tracking ID — de-emphasized monospace chip with a
                    copy button, since this is the one field an admin
                    actually needs to hand off to a student, not read
                    inline like the rest. */}
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      selectedRequest.tracking_id,
                      'Tracking ID'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  title="Salin Tracking ID"
                >
                  <span className="font-mono">
                    {selectedRequest.tracking_id}
                  </span>
                  <Copy size={12} strokeWidth={1.8} />
                </button>

                {/* Core info */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="Email" value={selectedRequest.student.email} />
                  <Field
                    label="Program Studi"
                    value={selectedRequest.student.program_studi}
                  />
                  <Field label="Keperluan" value={selectedRequest.keperluan} />
                  <Field
                    label="Dibuat Pada"
                    value={new Date(selectedRequest.created_at).toLocaleString(
                      'id-ID'
                    )}
                  />
                  <div className="col-span-2">
                    <Field
                      label="Catatan Admin"
                      value={selectedRequest.admin_notes || '—'}
                    />
                  </div>
                </div>

                {selectedRequest.student_data && (
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="mb-3 text-[13px] font-semibold text-slate-900">
                      Data Mahasiswa
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {Object.entries(selectedRequest.student_data).map(
                        ([key, value]) => (
                          <Field
                            key={key}
                            label={formatLabel(key)}
                            value={String(value)}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}

                {adminFormSchema && adminFormSchema.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="mb-3 text-[13px] font-semibold text-slate-900">
                      Data Admin
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {adminFormSchema.map((field: any) => (
                        <Field
                          key={field.name}
                          label={formatLabel(field.label || field.name)}
                          value={selectedRequest.admin_data?.[field.name] || '—'}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <p className="text-[13px] text-slate-500">Memuat...</p>
        )}
      </Modal>
    </div>
  );
};

export default Requests;