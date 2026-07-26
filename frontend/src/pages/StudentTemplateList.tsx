// src/pages/StudentTemplateList.tsx
import { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { TemplateItem } from '../types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Folder, BarChart2 } from 'lucide-react';

function StudentTemplateList() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await ApiService.listStudentTemplates();
        console.log("API response:", res);

        // ✅ directly use res.templates since backend already provides description
        const list: TemplateItem[] = res.templates?.map((t: TemplateItem) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          usage_count: t.usage_count,
          field_count: t.field_count,
          student_fields_count: t.student_fields_count,
        })) || [];

        console.log("Mapped templates:", list);
        setTemplates(list);
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

  const mostUsedTemplate = templates.length
    ? templates.reduce((prev, curr) => (curr.usage_count > prev.usage_count ? curr : prev), templates[0])
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero section */}
      <div className="relative h-48 flex items-center justify-center mb-8">
        <div className="absolute inset-0 bg-indigo-100 blur-xl rounded-xl"></div>
        <div className="relative text-center">
          <img src="/logo.png" alt="Logo" className="h-20 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-gray-900">Selamat Datang</h1>
          <p className="text-gray-700">Pilih template surat yang ingin diajukan</p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-3xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
        <div className="bg-white shadow rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500">Total Templates</p>
          <p className="text-xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500">Most Used Template</p>
          <p className="text-xl font-bold text-gray-900">{mostUsedTemplate?.name || '-'}</p>
        </div>
      </div>

      {/* Template grid */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/templates/${t.id}/form`)}
              className="bg-white shadow rounded-lg p-6 cursor-pointer hover:shadow-lg hover:bg-indigo-50 transition relative flex flex-col justify-between"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.name}</h2>
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                  {t.description || 'Deskripsi belum tersedia'}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                <div className="flex items-center space-x-1">
                  <Folder className="w-3 h-3" />
                  <span>{t.category || 'Umum'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart2 className="w-3 h-3" />
                  <span>Digunakan {t.usage_count ?? 0}x</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StudentTemplateList;
