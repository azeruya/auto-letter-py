// src/pages/StudentTemplateForm.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { ApiService } from '../services/api';
import { StudentFormData } from '../types';

type FormField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
};

type TemplateDetail = {
  id: string;
  name: string;
  description: string;
  form_schema: {
    sections: {
      name: string;
      fields: FormField[];
    }[];
  };
};

type DynamicFormInputs = {
  [key: string]: string;
};

function StudentTemplateForm() {
  const { templateId } = useParams<{ templateId: string }>(); // ✅ fix here
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<DynamicFormInputs>();
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
          form_schema: data.form_schema
        });
      } catch (err) {
        console.error("Failed to load template schema", err);
      }
    };
    fetchSchema();
  }, [templateId]);

  const onSubmit: SubmitHandler<DynamicFormInputs> = async (formFields) => {
    const studentData = localStorage.getItem('studentData');
    if (!studentData) {
      alert("Data mahasiswa tidak ditemukan. Silakan isi formulir mahasiswa terlebih dahulu.");
      navigate('/');
      return;
    }

    const parsedStudent = JSON.parse(studentData);

    const payload: StudentFormData = {
      ...parsedStudent,
      template_id: templateId!,   // ✅ use templateId
      form_data: formFields
    };

    try {
      await ApiService.submitStudentRequest(payload);
      alert("Pengajuan surat berhasil dikirim!");
      navigate('/');
    } catch (err) {
      console.error("Failed to submit request", err);
      alert("Gagal mengirim pengajuan surat.");
    }
  };

  if (!template) return <p>Loading...</p>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{template.name}</h1>
      <p className="mb-4 text-gray-600">{template.description}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {template.form_schema.sections?.map((section) => (
          <div key={section.name} className="mb-6">
            <h2 className="text-lg font-semibold mb-2">{section.name}</h2>
            {section.fields.map((field) => (
              <div key={field.name} className="mb-4">
                <label className="block mb-1 font-medium">{field.label}</label>
                <input
                  type={field.type || "text"}
                  {...register(field.name, { required: field.required })}
                  className="w-full border p-2 rounded"
                />
                {errors[field.name] && (
                  <p className="text-red-500 text-sm">{field.label} wajib diisi</p>
                )}
              </div>
            ))}
          </div>
        ))}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Kirim Pengajuan
        </button>
      </form>
    </div>
  );
}

export default StudentTemplateForm;
