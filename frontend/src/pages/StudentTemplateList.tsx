// src/pages/StudentTemplateList.tsx
import { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { TemplateItem } from '../types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

function StudentTemplateList() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await ApiService.listStudentTemplates();
        console.log('Student templates API response:', res);

        // Handle backend returning array or object with "templates" key
        // Normalize backend response so id is always present
        const rawList = Array.isArray(res) ? res : res.templates ?? [];
        const list: TemplateItem[] = rawList.map((item: any) => ({
          id: item.id ?? item.template_id, // handle both id and template_id
          name: item.name,
          category: item.category,
          description: item.description,
          usage_count: item.usage_count,
        }));
        setTemplates(list);

        console.log("Normalized templates:", list);

      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  if (loading) return <p className="text-center mt-10">Loading templates...</p>;

  if (templates.length === 0)
    return <p className="text-center mt-10 text-gray-500">No templates available at the moment.</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Pilih Template Surat</h1>
      <div className="grid gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="border p-4 rounded shadow cursor-pointer hover:bg-gray-100"
            onClick={() => navigate(`/templates/${t.id}/form`)}
          >
            <h2 className="font-semibold">{t.name}</h2>
            <p className="text-sm text-gray-600">{t.description || '-'}</p>
            <p className="text-xs text-gray-500">
              Kategori: {t.category || 'Umum'} | Digunakan {t.usage_count ?? 0}x
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentTemplateList;
