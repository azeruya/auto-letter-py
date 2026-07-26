// src/pages/ProcessRequest.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ApiService } from "../services/api";
import { Form } from "antd";
import toast from "react-hot-toast";
import LoadingSpinner from "../components/LoadingSpinner";

// Same helper as StudentTemplateForm.tsx / Requests.tsx — this is the
// third file that needs it now, worth extracting to a shared
// src/utils/formatLabel.ts and importing everywhere instead.
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

const ProcessRequest = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState<any>(null);
  const [adminSchema, setAdminSchema] = useState<any[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!id) return;
    const fetchDetails = async () => {
      try {
        const data = await ApiService.getRequestDetails(id);
        setRequestData(data.request);
        setAdminSchema(data.admin_form_schema?.fields || []);

        // Prefill student, admin, and notes
        form.setFieldsValue({
          ...data.request.student_data,
          ...data.request.admin_data,
          admin_notes: data.request.admin_notes || "",
          // Prefill auto fields if any
          ...Object.fromEntries(
            (data.request.template.field_assignments.auto_fields || []).map(
              (field: string) => [field, new Date().toISOString().split("T")[0]]
            )
          ),
        });
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Gagal memuat detail permohonan");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, form]);

  const handleProcess = async (values: any) => {
    try {
      const payload = {
        form_data: values,
        admin_notes: values.admin_notes || "",
      };

      await ApiService.processRequest(id!, payload);

      toast.success("Permohonan berhasil diproses");
      navigate("/dashboard/requests");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail?.message || "Gagal memproses permohonan");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <LoadingSpinner size="lg" text="Memuat permohonan..." />
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          Permohonan tidak ditemukan
        </p>
        <p className="mt-1 text-[13px] text-slate-400">
          Permohonan ini mungkin sudah dihapus atau tidak tersedia.
        </p>
      </div>
    );
  }

  const { template } = requestData;
  const { student_fields, admin_fields, auto_fields } = template.field_assignments;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Proses Permohonan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tracking ID:{' '}
          <span className="font-mono text-slate-700">
            {requestData.tracking_id}
          </span>
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleProcess}
        requiredMark={false}
        className="space-y-5"
      >
        {/* Student fields — read-only, filled in by the student */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Data Mahasiswa
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Hanya baca
            </span>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {student_fields.map((field: string) => (
              <Form.Item
                key={field}
                label={
                  <span className="form-label mb-0">{formatLabel(field)}</span>
                }
                name={field}
                className="mb-0"
              >
                <input disabled className="form-input bg-slate-50 text-slate-500" />
              </Form.Item>
            ))}
          </div>
        </section>

        {/* Admin fields — editable */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            Data Admin
          </h3>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {admin_fields.map((field: string) => (
              <Form.Item
                key={field}
                label={
                  <span className="form-label mb-0">{formatLabel(field)}</span>
                }
                name={field}
                className="mb-0"
              >
                <input className="form-input" />
              </Form.Item>
            ))}

            {/* Fallback: admin_schema from backend */}
            {adminSchema.map((field: any) => (
              <Form.Item
                key={field.name}
                label={
                  <span className="form-label mb-0">
                    {formatLabel(field.label || field.name)}
                  </span>
                }
                name={field.name}
                className="mb-0"
                rules={
                  field.required
                    ? [
                        {
                          required: true,
                          message: `${formatLabel(field.label || field.name)} wajib diisi`,
                        },
                      ]
                    : []
                }
              >
                <input className="form-input" />
              </Form.Item>
            ))}
          </div>
        </section>

        {/* Auto fields — prefilled & locked */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Data Otomatis
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Terisi otomatis
            </span>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {auto_fields.map((field: string) => (
              <Form.Item
                key={field}
                label={
                  <span className="form-label mb-0">{formatLabel(field)}</span>
                }
                name={field}
                className="mb-0"
              >
                <input disabled className="form-input bg-slate-50 text-slate-500" />
              </Form.Item>
            ))}
          </div>
        </section>

        {/* Admin notes */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Form.Item
            label={<span className="form-label mb-0">Catatan Admin</span>}
            name="admin_notes"
            className="mb-0"
          >
            <textarea rows={3} className="form-input" />
          </Form.Item>
        </section>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard/requests")}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Batal
          </button>

          <button type="submit" className="btn-primary h-10 px-5">
            Proses Permohonan
          </button>
        </div>
      </Form>
    </div>
  );
};

export default ProcessRequest;