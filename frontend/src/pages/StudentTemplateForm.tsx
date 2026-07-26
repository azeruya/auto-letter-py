import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FormProvider,
  SubmitHandler,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { ApiService } from '../services/api';
import { StudentFormData } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

type FieldWidth = 'half' | 'full';

type FormField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  repeatable?: boolean;
  order?: number;
  width?: FieldWidth;
  options?: string[];
  editable?: boolean;
  value?: unknown;
};

type Section = {
  id?: string;
  name: string;
  title?: string;
  description?: string;
  order?: number;
  fields: FormField[];
};

type TemplateDetail = {
  id: string;
  name: string;
  description?: string;
  form_schema: {
    sections: Section[];
  };
};

type DynamicFormInputs = Record<string, any>;

const KNOWN_ACRONYMS = new Set([
  'nim',
  'nip',
  'nik',
  'ktp',
  'kk',
  'sks',
  'ipk',
]);

function formatLabel(rawLabel?: string): string {
  if (!rawLabel) return '';

  return rawLabel
    .replace(/_/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lowercaseWord = word.toLowerCase();

      if (KNOWN_ACRONYMS.has(lowercaseWord)) {
        return lowercaseWord.toUpperCase();
      }

      return (
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
      );
    })
    .join(' ');
}

function fieldErrorMessage(field: FormField): string {
  return `${formatLabel(field.label || field.name)} wajib diisi`;
}

function RepeatableField({ field }: { field: FormField }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<DynamicFormInputs>();

  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({
    control,
    name: field.name,
  });

  useEffect(() => {
    if (rows.length === 0) {
      append({ value: '' });
    }
  }, [append, rows.length]);

  const fieldErrors = errors[field.name];

  return (
    <div>
      <label className="form-label">
        {formatLabel(field.label || field.name)}

        {field.required && (
          <span className="ml-0.5 text-rose-600">*</span>
        )}
      </label>

      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-start gap-2"
          >
            <input
              type={field.type || 'text'}
              {...register(`${field.name}.${index}.value`, {
                required: field.required,
              })}
              disabled={field.editable === false}
              className="form-input min-w-0 flex-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />

            <button
              type="button"
              onClick={() => remove(index)}
              disabled={rows.length === 1}
              className="
                flex h-12 w-12 shrink-0 items-center justify-center
                rounded-lg border border-slate-200 bg-white
                text-slate-500 transition
                hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600
                disabled:cursor-not-allowed disabled:opacity-40
              "
              aria-label={`Hapus baris ${index + 1}`}
              title="Hapus baris"
            >
              <Minus size={17} strokeWidth={1.8} />
            </button>
          </div>
        ))}

        {fieldErrors && (
          <p className="text-xs text-rose-600">
            {fieldErrorMessage(field)}
          </p>
        )}

        <button
          type="button"
          onClick={() => append({ value: '' })}
          className="
            inline-flex h-9 items-center gap-1.5 rounded-lg
            border border-slate-200 bg-white px-3
            text-[13px] font-medium text-slate-600
            transition hover:border-slate-300
            hover:bg-slate-50 hover:text-slate-900
          "
        >
          <Plus size={15} strokeWidth={1.8} />
          Tambah baris
        </button>
      </div>
    </div>
  );
}

function StandardField({ field }: { field: FormField }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<DynamicFormInputs>();

  const validation = {
    required: field.required,
  };

  const sharedClassName = `
    form-input
    disabled:cursor-not-allowed
    disabled:bg-slate-50
    disabled:text-slate-500
  `;

  const hasError = Boolean(errors[field.name]);

  const renderField = () => {
    if (field.type === 'textarea') {
      return (
        <textarea
          {...register(field.name, validation)}
          defaultValue={
            typeof field.value === 'string'
              ? field.value
              : undefined
          }
          disabled={field.editable === false}
          rows={4}
          className={`${sharedClassName} min-h-[108px] resize-y py-3`}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          {...register(field.name, validation)}
          defaultValue={
            typeof field.value === 'string'
              ? field.value
              : ''
          }
          disabled={field.editable === false}
          className="form-select disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="">Pilih salah satu</option>

          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type || 'text'}
        {...register(field.name, validation)}
        defaultValue={
          typeof field.value === 'string' ||
          typeof field.value === 'number'
            ? field.value
            : undefined
        }
        disabled={field.editable === false}
        className={sharedClassName}
      />
    );
  };

  return (
    <div>
      <label className="form-label">
        {formatLabel(field.label || field.name)}

        {field.required && (
          <span className="ml-0.5 text-rose-600">*</span>
        )}
      </label>

      {renderField()}

      {hasError && (
        <p className="mt-1.5 text-xs text-rose-600">
          {fieldErrorMessage(field)}
        </p>
      )}
    </div>
  );
}

function StudentTemplateForm() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const methods = useForm<DynamicFormInputs>({
    defaultValues: {},
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const [template, setTemplate] =
    useState<TemplateDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(
    null
  );

  const fetchSchema = async () => {
    if (!templateId) {
      setLoadError('Template tidak ditemukan.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const data =
        await ApiService.getStudentFormSchema(templateId);

      setTemplate({
        id: data.template.id,
        name: data.template.name,
        description: data.template.description,
        form_schema: {
          sections: data.form_schema?.sections ?? [],
        },
      });
    } catch (error: any) {
      console.error('Failed to load template schema:', error);

      setLoadError(
        error?.detail ||
          error?.message ||
          'Gagal memuat formulir.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, [templateId]);

  const orderedSections = useMemo(() => {
    if (!template) return [];

    return [...template.form_schema.sections]
      .sort(
        (first, second) =>
          (first.order ?? 0) - (second.order ?? 0)
      )
      .map((section) => ({
        ...section,
        fields: [...section.fields].sort(
          (first, second) =>
            (first.order ?? 0) - (second.order ?? 0)
        ),
      }));
  }, [template]);

  const onSubmit: SubmitHandler<DynamicFormInputs> = async (
    formFields
  ) => {
    if (!templateId) {
      toast.error('Template tidak ditemukan.');
      return;
    }

    const storedStudentData =
      localStorage.getItem('studentData');

    if (!storedStudentData) {
      toast.error(
        'Data mahasiswa tidak ditemukan. Silakan isi data mahasiswa terlebih dahulu.'
      );
      navigate('/');
      return;
    }

    try {
      const parsedStudentData = JSON.parse(
        storedStudentData
      );

      const payload: StudentFormData = {
        ...parsedStudentData,
        template_id: templateId,
        form_data: formFields,
      };

      await ApiService.submitStudentRequest(payload);

      toast.success('Pengajuan surat berhasil dikirim.');

      localStorage.removeItem('studentData');
      navigate('/');
    } catch (error: any) {
      console.error('Failed to submit request:', error);

      toast.error(
        error?.detail ||
          error?.message ||
          'Gagal mengirim pengajuan surat.'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner
          size="lg"
          text="Memuat formulir..."
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <ErrorMessage
            message={loadError}
            onRetry={fetchSchema}
          />
        </div>
      </div>
    );
  }

  if (!template) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-10">
      {/* Page heading */}
      <header className="mx-auto mb-7 max-w-3xl text-center">
        <img
          src="/logo.png"
          alt="Universitas Negeri Padang"
          className="mx-auto h-16 w-16 object-contain"
        />

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Sistem Administrasi Surat
        </p>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[26px]">
          {template.name}
        </h1>

        {template.description && (
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            {template.description}
          </p>
        )}
      </header>

      {/* Form card */}
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-7 px-6 py-7 sm:px-8 sm:py-8">
              {orderedSections.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Tidak ada field yang perlu diisi
                  </p>

                  <p className="mt-1 text-[13px] text-slate-500">
                    Silakan hubungi administrator jika formulir
                    tidak sesuai.
                  </p>
                </div>
              ) : (
                orderedSections.map((section, sectionIndex) => (
                  <section
                    key={
                      section.id ||
                      `${section.name}-${sectionIndex}`
                    }
                    className="
                      border-b border-slate-200 pb-7
                      last:border-b-0 last:pb-0
                    "
                  >
                    <div className="mb-5">
                      <h2 className="text-base font-semibold text-slate-900">
                        {section.name}
                      </h2>

                      {section.description && (
                        <p className="mt-1 text-[13px] leading-5 text-slate-500">
                          {section.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                      {section.fields.map((field) => {
                        const isFullWidth =
                          field.repeatable ||
                          field.width === 'full';

                        return (
                          <div
                            key={field.name}
                            className={
                              isFullWidth
                                ? 'sm:col-span-2'
                                : ''
                            }
                          >
                            {field.repeatable ? (
                              <RepeatableField
                                field={field}
                              />
                            ) : (
                              <StandardField
                                field={field}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>

            {/* Form actions */}
            <footer className="flex items-center justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-4 sm:px-8">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  orderedSections.length === 0
                }
                className="btn-primary h-11 min-w-[150px] px-6"
              >
                {isSubmitting ? (
                  <LoadingSpinner
                    size="sm"
                    text="Mengirim..."
                  />
                ) : (
                  'Kirim Pengajuan'
                )}
              </button>
            </footer>
          </form>
        </FormProvider>
      </section>
    </main>
  );
}

export default StudentTemplateForm;