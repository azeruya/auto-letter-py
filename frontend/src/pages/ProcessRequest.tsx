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

type SchemaField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  repeatable?: boolean;
  order?: number;
  width?: 'half' | 'full';
  options?: string[];
};

type SchemaSection = {
  id?: string;
  name: string;
  description?: string;
  order?: number;
  fields: SchemaField[];
};

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


function getSubmittedValue(
  data: Record<string, any> | null | undefined,
  fieldName: string
): any {
  if (!data) return undefined;

  // New format: literal key "row.nim"
  if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
    return data[fieldName];
  }

  // Old format: { row: { nim: [...] } }
  return fieldName.split('.').reduce<any>(
    (current, key) => current?.[key],
    data
  );
}

function formatSubmittedValues(value: any): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap(formatSubmittedValues);
  }

  if (typeof value === 'object') {
    if ('value' in value) {
      return formatSubmittedValues(value.value);
    }
    return [];
  }

  const text = String(value).trim();
  return text ? [text] : [];
}

const ProcessRequest = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState<any>(null);
  const [formSchema, setFormSchema] = useState<SchemaSection[]>([]);
  const [form] = Form.useForm();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);

        const data = await ApiService.getRequestDetails(id);

        setRequestData(data.request);

        setFormSchema(
          data.request?.template?.schema?.sections ??
          data.form_schema?.sections ??
          []
        );

        const autoFields =
          data.request?.template?.field_assignments?.auto_fields ?? [];

        const autoValues =
          data.auto_values ??
          data.request.auto_data ??
          {};

        form.setFieldsValue({
          ...data.request.student_data,
          ...data.request.admin_data,
          ...autoValues,
          admin_notes: data.request.admin_notes || '',
        });

        const buildAutoDefaults = (fields: string[]) =>
          Object.fromEntries(
            fields.map((field) => {
              const normalized = field.toLowerCase();

              if (
                normalized.includes('tanggal') ||
                normalized.includes('date')
              ) {
                return [
                  field,
                  new Date().toISOString().split('T')[0],
                ];
              }

              return [field, ''];
            })
          );
        form.setFieldsValue({
          ...data.request.student_data,
          ...data.request.admin_data,
          ...buildAutoDefaults(autoFields),
          admin_notes: data.request.admin_notes || '',
        });
      } catch (err: any) {
        toast.error(
          err?.detail ||
            err?.message ||
            'Gagal memuat detail permohonan'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, form]);

  const handleProcess = async (values: any) => {
    try {
      setProcessing(true);

      const adminFormData = Object.fromEntries(
        adminFields.map((field) => [
          field,
          values[field],
        ])
      );

      await ApiService.processRequest(id!, {
        form_data: adminFormData,
        admin_notes: values.admin_notes || '',
      });

      toast.success('Permohonan berhasil diproses');
      navigate('/dashboard/requests');
    } catch (err: any) {
      toast.error(
        err?.detail ||
          err?.message ||
          'Gagal memproses permohonan'
      );
    } finally {
      setProcessing(false);
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
  const assignments = template.field_assignments ?? {};

  const studentFields: string[] =
    assignments.student_fields ?? [];

  const adminFields: string[] =
    assignments.admin_fields ?? [];

  const autoFields: string[] =
    assignments.auto_fields ?? [];

  const sortSections = (sections: SchemaSection[]) =>
    [...sections]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((section) => ({
        ...section,
        fields: [...section.fields].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        ),
      }));

  const filterSectionsByFields = (
    sections: SchemaSection[],
    allowedFields: string[]
  ) => {
    const allowed = new Set(allowedFields);

    return sortSections(sections)
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) =>
          allowed.has(field.name)
        ),
      }))
      .filter((section) => section.fields.length > 0);
  };

  const studentSections = filterSectionsByFields(
    formSchema,
    studentFields
  );

  const adminSections = filterSectionsByFields(
    formSchema,
    adminFields
  );

  const autoSections = filterSectionsByFields(
    formSchema,
    autoFields
  );

  const renderFieldInput = (
    field: SchemaField,
    disabled: boolean
  ) => {
    const inputClassName = disabled
      ? 'form-input bg-slate-50 text-slate-500'
      : 'form-input';

    const selectClassName = disabled
      ? 'form-select bg-slate-50 text-slate-500'
      : 'form-select';

    switch (field.type) {
      case 'select':
        return (
          <select
            disabled={disabled}
            className={selectClassName}
          >
            <option value="">Pilih salah satu</option>

            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            rows={4}
            disabled={disabled}
            className={`${inputClassName} min-h-[108px] resize-y py-3`}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            disabled={disabled}
            className={inputClassName}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            disabled={disabled}
            className={inputClassName}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            disabled={disabled}
            className={inputClassName}
          />
        );

      default:
        return (
          <input
            type="text"
            disabled={disabled}
            className={inputClassName}
          />
        );
    }
  };

  const renderCategorySections = (
    sections: SchemaSection[],
    options: {
      disabled: boolean;
      showRequiredRules?: boolean;
    }
  ) => {
    return sections.map((section, sectionIndex) => (
      <div
        key={section.id || `${section.name}-${sectionIndex}`}
        className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0"
      >
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-800">
            {section.name}
          </h4>

          {section.description && (
            <p className="mt-1 text-[13px] text-slate-500">
              {section.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          
          {section.fields.map((field) => {
            const fullWidth =
              field.repeatable || field.width === 'full';

            const isStudentField =
              options.disabled &&
              studentFields.includes(field.name);

            if (isStudentField && field.repeatable) {
              const rawValue = getSubmittedValue(
                requestData.student_data,
                field.name
              );

              const values = formatSubmittedValues(rawValue);

              return (
                <div
                  key={field.name}
                  className={fullWidth ? 'sm:col-span-2' : ''}
                >
                  <label className="form-label">
                    {formatLabel(field.label || field.name)}
                  </label>

                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {values.length > 0 ? (
                      values.map((value, index) => (
                        <div
                          key={index}
                          className="flex gap-3 text-sm text-slate-700"
                        >
                          <span className="shrink-0 text-slate-400">
                            {index + 1}.
                          </span>
                          <span className="break-words">{value}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        Belum diisi
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <Form.Item
                key={field.name}
                label={
                  <span className="form-label mb-0">
                    {formatLabel(field.label || field.name)}
                  </span>
                }
                name={field.name}
                className={`mb-0 ${
                  fullWidth ? 'sm:col-span-2' : ''
                }`}
                rules={
                  options.showRequiredRules && field.required
                    ? [
                        {
                          required: true,
                          message: `${formatLabel(
                            field.label || field.name
                          )} wajib diisi`,
                        },
                      ]
                    : []
                }
              >
                {renderFieldInput(field, options.disabled)}
              </Form.Item>
            );
          })}

        </div>
      </div>
    ));
  };

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
        {studentSections.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Data Mahasiswa
              </h3>

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Hanya baca
              </span>
            </div>

            <div className="space-y-5">
              {renderCategorySections(studentSections, {
                disabled: true,
              })}
            </div>
          </section>
        )}

        {/* Admin fields — editable */}
        {adminSections.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-5 text-base font-semibold text-slate-900">
              Data Admin
            </h3>

            <div className="space-y-5">
              {renderCategorySections(adminSections, {
                disabled: false,
                showRequiredRules: true,
              })}
            </div>
          </section>
        )}

        {/* Auto fields — prefilled & locked */}
        {autoSections.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Data Otomatis
              </h3>

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Terisi otomatis
              </span>
            </div>

            <div className="space-y-5">
              {renderCategorySections(autoSections, {
                disabled: true,
              })}
            </div>
          </section>
        )}

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

          <button
            type="submit"
            disabled={processing}
            className="btn-primary h-10 min-w-[170px] px-5"
          >
            {processing ? (
              <LoadingSpinner
                size="sm"
                text="Memproses..."
              />
            ) : (
              'Proses Permohonan'
            )}
          </button>
        </div>
      </Form>
    </div>
  );
};

export default ProcessRequest;