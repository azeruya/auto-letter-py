import { useEffect, useState, type ReactNode } from 'react';
import { ApiService } from '../services/api';
import toast from 'react-hot-toast';
import { Modal, Upload, Input, Select } from 'antd';
import LoadingSpinner from '../components/LoadingSpinner';

import {
  Eye,
  Trash2,
  SlidersHorizontal,
  Upload as UploadIcon,
  Plus,
  Copy,
  AlertTriangle,
} from 'lucide-react';

type TemplateItem = {
  id: string;
  name: string;
  category: string;
  original_filename: string;
  field_count: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Local navy override for antd's default-blue OK buttons — belt and
// suspenders until ConfigProvider's colorPrimary token is set app-wide.
const navyOkButtonProps = {
  style: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
};

const Templates = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload modal
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');

  // Details modal
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Field assignment modal
  const [fieldAssignmentsModalVisible, setFieldAssignmentsModalVisible] =
    useState(false);
  const [fieldAssignments, setFieldAssignments] = useState<{
    student_fields: string[];
    admin_fields: string[];
    auto_fields: string[];
  }>({ student_fields: [], admin_fields: [], auto_fields: [] });
  const [fieldAssignmentsChanged, setFieldAssignmentsChanged] =
    useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await ApiService.listTemplates();
      setTemplates(data.templates);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal memuat template');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleUpload = async () => {
    if (!file) return toast.error('Pilih file .docx terlebih dahulu');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('category', category);
      formData.append('description', description);
      await ApiService.uploadTemplate(formData);
      toast.success('Template berhasil diunggah');
      setUploadModalVisible(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal mengunggah template');
    }
  };

  const handleView = async (id: string) => {
    try {
      const details = await ApiService.getTemplateDetails(id);
      setSelectedTemplate(details);
      setDetailsModalVisible(true);
    } catch {
      toast.error('Gagal memuat detail template');
    }
  };

  // Delete confirmation — was a native confirm() dialog, same issue
  // as the old alert()s: unstyleable browser chrome. templateToDelete
  // holds the row so the modal can show its name in the confirmation.
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (template: TemplateItem) => {
    setTemplateToDelete(template);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      setDeleting(true);
      await ApiService.deleteTemplate(templateToDelete.id);
      toast.success('Template dihapus (soft delete)');
      setDeleteModalVisible(false);
      setTemplateToDelete(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus template');
    } finally {
      setDeleting(false);
    }
  };

  const handleFieldAssignments = async (templateId: string) => {
    try {
      const details = await ApiService.getTemplateDetails(templateId);
      setSelectedTemplate(details);
      setFieldAssignments({
        student_fields: details.field_assignments?.student_fields || [],
        admin_fields: details.field_assignments?.admin_fields || [],
        auto_fields: details.field_assignments?.auto_fields || [],
      });
      setFieldAssignmentsModalVisible(true);
    } catch {
      toast.error('Gagal memuat penugasan field template');
    }
  };

  const formatFieldLabel = (raw: string) =>
    raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="space-y-5">
      {/* Action bar — no page title here since the layout's top bar
          already shows "Template Surat"; repeating it would just be
          the same label twice on screen. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setUploadModalVisible(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus size={15} strokeWidth={2} />
          Unggah Template
        </button>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <LoadingSpinner size="lg" text="Memuat template..." />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">
              Belum ada template
            </p>
            <p className="mt-1 text-[13px] text-slate-400">
              Unggah file .docx untuk membuat template pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Nama
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Kategori
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Field
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Digunakan
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
                {templates.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-slate-900">
                        {t.name}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {t.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-slate-600">
                      {t.field_count}
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-slate-600">
                      {t.usage_count}
                    </td>

                    <td className="px-5 py-3.5">
                      {t.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Nonaktif
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Lihat Detail"
                          onClick={() => handleView(t.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <Eye size={14} strokeWidth={1.8} />
                        </button>

                        <button
                          type="button"
                          title="Atur Field"
                          onClick={() => handleFieldAssignments(t.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <SlidersHorizontal size={14} strokeWidth={1.8} />
                        </button>

                        <button
                          type="button"
                          title="Hapus"
                          onClick={() => openDeleteModal(t)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upload Modal */}
      <Modal
        title={
          <span className="text-[15px] font-semibold text-slate-900">
            Unggah Template
          </span>
        }
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        onOk={handleUpload}
        okText="Unggah"
        cancelText="Batal"
        okButtonProps={navyOkButtonProps}
      >
        <div className="space-y-3 pt-1">
          <Upload
            beforeUpload={(file) => {
              setFile(file);
              return false;
            }}
            maxCount={1}
          >
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <UploadIcon size={14} strokeWidth={1.8} />
              Pilih File .docx
            </button>
          </Upload>

          <Input
            placeholder="Nama Template"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input.TextArea
            placeholder="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Select
            value={category}
            onChange={(val) => setCategory(val)}
            className="w-full"
          >
            <Select.Option value="general">Umum</Select.Option>
            <Select.Option value="academic">Akademik</Select.Option>
            <Select.Option value="administrative">Administratif</Select.Option>
          </Select>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        title={
          <span className="text-[15px] font-semibold text-slate-900">
            Detail Template
          </span>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
        width={600}
        centered
      >
        {selectedTemplate ? (
          (() => {
            const copyToClipboard = (value: string, label: string) => {
              navigator.clipboard.writeText(value);
              toast.success(`${label} disalin`);
            };

            // Same pattern as the Requests.tsx details modal — one
            // label/value component instead of ad hoc inline sentences.
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
                {/* Header: name + status, the two things read first */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {selectedTemplate.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {selectedTemplate.description || 'Tidak ada deskripsi'}
                    </p>
                  </div>

                  {selectedTemplate.is_active ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Nonaktif
                    </span>
                  )}
                </div>

                {/* ID — de-emphasized monospace chip with copy button,
                    same treatment as Tracking ID in Requests.tsx */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedTemplate.id, 'ID')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  title="Salin ID"
                >
                  <span className="font-mono">{selectedTemplate.id}</span>
                  <Copy size={12} strokeWidth={1.8} />
                </button>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field
                    label="Kategori"
                    value={
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {selectedTemplate.category}
                      </span>
                    }
                  />
                  <Field
                    label="Dibuat Pada"
                    value={formatDate(selectedTemplate.created_at)}
                  />
                  <div className="col-span-2">
                    <Field
                      label="File Asli"
                      value={selectedTemplate.original_filename}
                    />
                  </div>
                  <div className="col-span-2">
                    <Field
                      label="Field"
                      value={
                        selectedTemplate.placeholders?.length
                          ? selectedTemplate.placeholders
                              .map((ph: string) => formatFieldLabel(ph))
                              .join(', ')
                          : '—'
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <p className="text-[13px] text-slate-500">Memuat...</p>
        )}
      </Modal>

      {/* Delete confirmation — replaces native confirm() */}
      <Modal
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setTemplateToDelete(null);
        }}
        footer={null}
        width={420}
        centered
      >
        <div className="flex flex-col items-center pt-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle size={20} strokeWidth={1.8} />
          </div>

          <h3 className="mt-3 text-[15px] font-semibold text-slate-900">
            Nonaktifkan template ini?
          </h3>

          <p className="mt-1.5 text-[13px] text-slate-500">
            <span className="font-medium text-slate-700">
              {templateToDelete?.name}
            </span>{' '}
            akan dinonaktifkan dan tidak lagi tersedia untuk permohonan baru.
            Tindakan ini dapat dibatalkan nanti melalui pengaturan template.
          </p>

          <div className="mt-5 flex w-full gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteModalVisible(false);
                setTemplateToDelete(null);
              }}
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-10 flex-1 rounded-lg bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Menonaktifkan...' : 'Nonaktifkan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Field Assignment Modal */}
      <Modal
        title={
          <span className="text-[15px] font-semibold text-slate-900">
            Atur Field untuk {selectedTemplate?.name}
          </span>
        }
        open={fieldAssignmentsModalVisible}
        onCancel={() => setFieldAssignmentsModalVisible(false)}
        footer={null}
        width={600}
        centered
      >
        {selectedTemplate?.placeholders?.length ? (
          (() => {
            const total = selectedTemplate.placeholders.length;
            const assignedCount =
              fieldAssignments.student_fields.length +
              fieldAssignments.admin_fields.length +
              fieldAssignments.auto_fields.length;
            const complete = assignedCount === total;

            const assignmentStyles: Record<
              'student' | 'admin' | 'auto',
              string
            > = {
              student: 'bg-indigo-500',
              admin: 'bg-slate-900',
              auto: 'bg-teal-500',
            };

            const handleSave = async () => {
              try {
                setSavingAssignments(true);
                await ApiService.updateFieldAssignments(
                  selectedTemplate.id,
                  fieldAssignments
                );
                toast.success('Penugasan field berhasil diperbarui');
                setFieldAssignmentsModalVisible(false);
                setFieldAssignmentsChanged(false);
              } catch (err: any) {
                toast.error(
                  err.response?.data?.detail ||
                    'Gagal memperbarui penugasan field'
                );
              } finally {
                setSavingAssignments(false);
              }
            };

            return (
              // Everything — counter, scrollable list, footer buttons —
              // is one normal-flow column now instead of splitting the
              // buttons into antd's separate footer slot, which is what
              // caused the footer to overlap the list on short viewports.
              <div className="flex flex-col">
                <div
                  className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium ${
                    complete
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      complete ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {assignedCount} dari {total} field ditugaskan
                  {!complete && ' — lengkapi sisanya sebelum menyimpan'}
                </div>

                <div className="max-h-[45vh] overflow-y-auto pr-2">
                  {selectedTemplate.placeholders.map((placeholder: string) => {
                    const label = formatFieldLabel(placeholder);

                    let assignment: 'student' | 'admin' | 'auto' | null = null;
                    if (fieldAssignments.student_fields.includes(placeholder))
                      assignment = 'student';
                    else if (
                      fieldAssignments.admin_fields.includes(placeholder)
                    )
                      assignment = 'admin';
                    else if (
                      fieldAssignments.auto_fields.includes(placeholder)
                    )
                      assignment = 'auto';

                    return (
                      <div
                        key={placeholder}
                        className={`flex items-center justify-between gap-3 rounded-lg border-b border-slate-100 px-2 py-2.5 ${
                          assignment === null ? 'bg-amber-50/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              assignment
                                ? assignmentStyles[assignment]
                                : 'bg-amber-400'
                            }`}
                          />
                          <span className="text-[13px] font-medium text-slate-700">
                            {label}
                          </span>
                        </div>

                        <Select
                          value={assignment}
                          placeholder="Pilih"
                          onChange={(val: 'student' | 'admin' | 'auto') => {
                            setFieldAssignments((prev) => {
                              const newAssignments = {
                                student_fields: prev.student_fields.filter(
                                  (f) => f !== placeholder
                                ),
                                admin_fields: prev.admin_fields.filter(
                                  (f) => f !== placeholder
                                ),
                                auto_fields: prev.auto_fields.filter(
                                  (f) => f !== placeholder
                                ),
                              };
                              if (val === 'student')
                                newAssignments.student_fields.push(
                                  placeholder
                                );
                              else if (val === 'admin')
                                newAssignments.admin_fields.push(placeholder);
                              else if (val === 'auto')
                                newAssignments.auto_fields.push(placeholder);
                              setFieldAssignmentsChanged(true);
                              return newAssignments;
                            });
                          }}
                          style={{ width: 160 }}
                        >
                          <Select.Option value="student">
                            Mahasiswa
                          </Select.Option>
                          <Select.Option value="admin">Admin</Select.Option>
                          <Select.Option value="auto">Otomatis</Select.Option>
                        </Select>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setFieldAssignmentsModalVisible(false)}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!fieldAssignmentsChanged || savingAssignments}
                    className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAssignments ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <p className="text-[13px] italic text-slate-400">
            Tidak ada field untuk ditugaskan.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default Templates;