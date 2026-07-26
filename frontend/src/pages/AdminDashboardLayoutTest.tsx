import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { ApiService } from '../services/api';
import { Admin } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const initialForm = {
  username: '',
  email: '',
  full_name: '',
  password: '',
};

const AdminManagement: React.FC = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const fetchAdmins = async () => {
    try {
      setFetching(true);
      const data = await ApiService.listAdmins();
      setAdmins(data);
    } catch (err: any) {
      toast.error(
        err.detail ||
          err.message ||
          'Gagal memuat data administrator'
      );
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const updateForm = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleAddAdmin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setLoading(true);

    try {
      await ApiService.addAdmin(form);
      toast.success('Administrator baru berhasil ditambahkan');
      setForm(initialForm);
      await fetchAdmins();
    } catch (err: any) {
      toast.error(
        err.detail ||
          err.message ||
          'Gagal menambahkan administrator'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';

    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-sm font-medium text-blue-700">
          Pengaturan akses
        </p>

        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Administrator
        </h2>

        <p className="mt-1.5 text-sm text-slate-500">
          Kelola akun administrator yang dapat mengakses sistem.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total administrator
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {admins.length}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Pernah masuk
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {admins.filter((admin) => admin.last_login).length}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Administrator table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Daftar Administrator
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Seluruh akun yang memiliki akses ke panel administrasi.
            </p>
          </div>

          {fetching ? (
            <div className="flex min-h-64 items-center justify-center">
              <LoadingSpinner
                size="lg"
                text="Memuat administrator..."
              />
            </div>
          ) : admins.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <UserRound size={22} />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                Belum ada administrator
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Tambahkan administrator melalui formulir di samping.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Administrator
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Nama pengguna
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Dibuat
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Terakhir masuk
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {admins.map((admin) => (
                    <tr
                      key={admin.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                            {(admin.full_name ||
                              admin.username ||
                              'A')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {admin.full_name || 'Tanpa nama'}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {admin.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {admin.username}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                        {formatDate(admin.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {admin.last_login ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {formatDate(admin.last_login)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Belum pernah
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Add administrator form */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-blue-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Tambah Administrator
              </h3>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Buat akun baru untuk petugas yang berwenang.
            </p>
          </div>

          <form
            onSubmit={handleAddAdmin}
            className="space-y-4 p-5"
          >
            <div>
              <label htmlFor="full_name" className="form-label">
                Nama lengkap
              </label>
              <input
                id="full_name"
                type="text"
                value={form.full_name}
                onChange={(e) =>
                  updateForm('full_name', e.target.value)
                }
                placeholder="Masukkan nama lengkap"
                className="form-input"
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="form-label">
                Nama pengguna
              </label>
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) =>
                  updateForm('username', e.target.value)
                }
                placeholder="Masukkan nama pengguna"
                autoComplete="username"
                className="form-input"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  updateForm('email', e.target.value)
                }
                placeholder="nama@unp.ac.id"
                autoComplete="email"
                className="form-input"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Kata sandi
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) =>
                    updateForm('password', e.target.value)
                  }
                  placeholder="Masukkan kata sandi"
                  autoComplete="new-password"
                  className="form-input pr-12"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  aria-label={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 h-11 w-full"
            >
              {loading ? (
                <LoadingSpinner
                  size="sm"
                  text="Menambahkan..."
                />
              ) : (
                <>
                  <Plus size={17} />
                  Tambah administrator
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminManagement;