import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, SubmitHandler, useFieldArray, FormProvider, useFormContext } from "react-hook-form";
import { ApiService } from "../services/api";
import { StudentFormData } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import toast from "react-hot-toast";

type FormField = { name: string; label: string; type: string; required: boolean; repeatable?: boolean; };
type Section = { name: string; fields: FormField[]; };
type TemplateDetail = { id: string; name: string; description: string; form_schema: { sections: Section[]; }; };
type DynamicFormInputs = { [key: string]: any; };

// Common Indonesian academic-form abbreviations that should stay fully
// uppercase instead of being Title Cased like a normal word.
const KNOWN_ACRONYMS = new Set(['nim', 'nip', 'nik', 'ktp', 'kk', 'sks', 'ipk']);

// Backend labels arrive as raw schema strings ("Tanggal_akhir", "Nim1")
// — this turns them into "Tanggal Akhir" / "NIM 1" for display, without
// touching the underlying field.name used for form registration.
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

function RepeatableField({ field }: { field: FormField }) {
  const { control, register } = useFormContext<DynamicFormInputs>();
  const { fields: arrayFields, append, remove } = useFieldArray({
    control,
    name: field.name,
  });

  // Ensure at least one row exists
  useEffect(() => {
    if (arrayFields.length === 0) append({ value: "" });
  }, [arrayFields.length, append]);

  return (
    <div>
      <label className="form-label">
        {formatLabel(field.label)} {field.required && <span className="text-rose-600">*</span>}
      </label>

      <div className="space-y-3">
        {arrayFields.map((row, idx) => (
          <div key={row.id} className="flex gap-2 items-center">
            <input
              type={field.type || "text"}
              {...register(`${field.name}[${idx}].value`, { required: field.required })}
              className="form-input flex-1"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 px-2.5 py-1 rounded-full text-xs font-medium transition"
            >
              Hapus
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => append({ value: "" })}
          className="border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 px-3 py-1 rounded-full shadow-sm text-sm transition flex items-center gap-1"
        >
          + Tambah Baris
        </button>
      </div>
    </div>
  );
}


function StudentTemplateForm() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const methods = useForm<DynamicFormInputs>({ defaultValues: {} });
  const { register, handleSubmit, control, formState: { errors } } = methods;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);

  useEffect(() => {
    const fetchSchema = async () => {
      if (!templateId) return;
      try {
        const data = await ApiService.getStudentFormSchema(templateId);
        setTemplate({
          id: data.template.id,
          name: data.template.name,
          description: data.template.description,
          form_schema: data.form_schema,
        });
      } catch (err) {
        console.error("Failed to load template schema", err);
      }
    };
    fetchSchema();
  }, [templateId]);

  const onSubmit: SubmitHandler<DynamicFormInputs> = async (formFields) => {
    const studentData = localStorage.getItem("studentData");
    if (!studentData) {
      toast.error("Data mahasiswa tidak ditemukan. Silakan isi formulir mahasiswa terlebih dahulu.");
      navigate("/");
      return;
    }
    const parsedStudent = JSON.parse(studentData);
    const payload: StudentFormData = {
      ...parsedStudent,
      template_id: templateId!,
      form_data: formFields,
    };
    try {
      await ApiService.submitStudentRequest(payload);
      toast.success("Pengajuan surat berhasil dikirim!");
      navigate("/");
    } catch (err) {
      console.error("Failed to submit request", err);
      toast.error("Gagal mengirim pengajuan surat.");
    }
  };

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <LoadingSpinner size="lg" text="Memuat formulir..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <img src="/logo.png" alt="Logo" className="h-16 mx-auto mb-3" />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Sistem Administrasi Surat
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {template.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{template.description}</p>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-xl border border-slate-200 p-8">
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {template.form_schema.sections?.map((section, sIdx) => (
              <div key={sIdx} className="border-b border-slate-200 pb-6 last:border-none">
                <h2 className="text-base font-semibold text-slate-900 mb-4">{section.name}</h2>
                {/* 2-column grid so short fields (Nim1, Prodi, dates)
                    aren't stretched to the full card width — that
                    stretch, not a missing background, was what made
                    the page read as empty. Repeatable fields span
                    both columns since they need room for their rows. */}
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  {section.fields.map((field, fIdx) => (
                    field.repeatable ? (
                      <div key={fIdx} className="sm:col-span-2">
                        <RepeatableField field={field} />
                      </div>
                    ) : (
                      <div key={fIdx}>
                        <label className="form-label">
                          {formatLabel(field.label)} {field.required && <span className="text-rose-600">*</span>}
                        </label>
                        <input
                          type={field.type || "text"}
                          {...register(field.name, { required: field.required })}
                          className="form-input"
                        />
                        {errors[field.name] && <p className="text-rose-600 text-xs mt-1.5">{formatLabel(field.label)} wajib diisi</p>}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                className="btn-primary px-6 h-11"
              >
                Kirim Pengajuan
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

export default StudentTemplateForm;