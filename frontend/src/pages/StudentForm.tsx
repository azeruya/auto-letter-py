// src/pages/StudentForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentFormData } from '../types';
import { ApiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

interface KeperluanOption {
  key: string;   // template.id (UUID)
  value: string; // template.name
}

const StudentForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<StudentFormData>({
    nama: '',
    nim: '',
    email: '',
    program_studi: '',
    keperluan: ''
  });
  const [keperluanOptions, setKeperluanOptions] = useState<KeperluanOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchKeperluan = async () => {
      try {
        const data = await ApiService.getKeperluanOptions();
        setKeperluanOptions(data);
      } catch (err) {
        console.error('Failed to load keperluan options', err);
      }
    };
    fetchKeperluan();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save locally for later use
    localStorage.setItem('studentData', JSON.stringify(formData));

    setTimeout(() => {
      setLoading(false);

      // ⬅️ now navigate directly to the template form
      navigate(`/templates/${formData.keperluan}/form`);
    }, 300);
  };

  return (
    // Same background token as the rest of the app (Layout.tsx uses
    // the same #F8FAFC), not a generic Tailwind gray-50.
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md bg-white shadow-sm rounded-xl border border-slate-200 p-8">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="University Logo" className="h-16" />
        </div>

        {/* Eyebrow + title, matching the login page's pattern of a
            small uppercase label above the main heading. */}
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Sistem Administrasi Surat
        </p>

        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 mb-1 text-center">
          Formulir Pengajuan Surat
        </h2>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Silakan isi data berikut untuk mengajukan surat
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="nama"
            placeholder="Nama"
            aria-label="Nama"
            value={formData.nama}
            onChange={handleChange}
            className="form-input"
            required
          />
          <input
            name="nim"
            placeholder="NIM"
            aria-label="NIM"
            value={formData.nim}
            onChange={handleChange}
            className="form-input"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            aria-label="Email"
            value={formData.email}
            onChange={handleChange}
            className="form-input"
            required
          />
          <input
            name="program_studi"
            placeholder="Program Studi"
            aria-label="Program Studi"
            value={formData.program_studi}
            onChange={handleChange}
            className="form-input"
            required
          />

          {/* Keperluan dropdown */}
          <select
            name="keperluan"
            aria-label="Keperluan"
            value={formData.keperluan}
            onChange={handleChange}
            className="form-select"
            required
          >
            <option value="" disabled>
              Pilih Keperluan
            </option>
            {keperluanOptions.map((k) => (
              <option key={k.key} value={k.key}>
                {k.value}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full flex justify-center items-center h-12 ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? <LoadingSpinner size="sm" text="Mengirim..." /> : 'Lanjut'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;