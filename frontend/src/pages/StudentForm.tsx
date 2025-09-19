// src/pages/StudentForm.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentFormData } from '../types';

function StudentForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<StudentFormData>({
    nama: '',
    nim: '',
    email: '',
    program_studi: '',
    keperluan: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 👉 Save in localStorage so we can use it later when submitting request
    localStorage.setItem('studentData', JSON.stringify(formData));
    navigate('/templates'); // redirect to templates page
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Formulir Pengajuan Surat</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="nama"
          placeholder="Nama"
          value={formData.nama}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <input
          name="nim"
          placeholder="NIM"
          value={formData.nim}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <input
          name="program_studi"
          placeholder="Program Studi"
          value={formData.program_studi}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <textarea
          name="keperluan"
          placeholder="Keperluan"
          value={formData.keperluan}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Lanjut
        </button>
      </form>
    </div>
  );
}

export default StudentForm;
