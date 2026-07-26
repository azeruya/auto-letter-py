import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { Eye, EyeOff, User } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      await login(username, password);
      toast.success('Berhasil masuk');
      navigate('/dashboard');
    } catch (err: any) {
      let message = 'Nama pengguna atau kata sandi tidak valid.';

      if (err.response?.data?.detail) {
        message = Array.isArray(err.response.data.detail)
          ? err.response.data.detail
              .map((detail: any) => detail.msg)
              .join(', ')
          : err.response.data.detail;
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4 py-6"
      style={{ backgroundImage: "url('/unp_2.JPG')" }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-slate-950/55" />

      {/* Login card */}
      <section className="relative z-10 w-full max-w-[440px] rounded-2xl bg-white px-8 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.34)] sm:px-10">
        {/* Branding */}
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Universitas Negeri Padang"
            className="mx-auto h-14 w-14 object-contain"
          />

          <p className="m-0 mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sistem Administrasi Surat
          </p>
        </div>

        {/* Heading */}
        <header className="mt-5 mb-7">
          <h1 className="m-0 text-[28px] font-bold text-center leading-tight tracking-tight text-slate-900">
            Masuk Administrator
          </h1>

          <p className="m-0 mt-2 text-[13px] text-center leading-5 text-slate-500">
            Silakan masuk menggunakan akun administrator.
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            {/* Username */}
            <div>
              <div className="relative">
                

                <input
                  id="username"
                  type="text"
                  value={username}
                  autoComplete="username"
                  placeholder="Nama pengguna"
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input "
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  placeholder="Kata sandi"
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pr-12"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  aria-label={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                  title={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.8} />
                  ) : (
                    <Eye size={18} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Remember me */}
          <div className="mt-4 flex items-center justify-between">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-300"
            />
            Ingat saya
          </label>

            <Link
              to="/forgot-password"
              className="text-[12px] font-medium text-slate-500 transition text-blue-500 hover:text-blue-700 hover:underline"
            >
              Lupa Kata Sandi?
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="error-message mt-4">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-8 h-11 w-full"
          >
            {loading ? (
              <LoadingSpinner size="sm" text="Sedang masuk..." />
            ) : (
              'Masuk'
            )}
          </button>
        </form>
      </section>
    </main>
  );
};

export default Login;