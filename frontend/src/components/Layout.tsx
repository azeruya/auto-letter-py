import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Layers3,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { RequestItem } from '@/types';
import { DashboardRequestItem } from '@/types';

const navItems = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: Home,
  },
  {
    name: 'Permohonan',
    path: '/dashboard/requests',
    icon: FileText,
  },
  {
    name: 'Template Surat',
    path: '/dashboard/templates',
    icon: Layers3,
  },
  {
    name: 'Administrator',
    path: '/dashboard/admins',
    icon: Users,
  },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/requests': 'Permohonan',
  '/dashboard/templates': 'Template Surat',
  '/dashboard/admins': 'Administrator',
};

const Layout = () => {
  const { logout, token } = useAuth();
  const location = useLocation();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState<
    DashboardRequestItem[]
  >([]);

  const notificationRef = useRef<HTMLDivElement>(null);

  const currentPageTitle =
    Object.entries(pageTitles).find(([path]) =>
      path === '/dashboard'
        ? location.pathname === path
        : location.pathname.startsWith(path)
    )?.[1] || 'Administrasi Surat';


  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setPendingCount(0);
      setPendingNotifications([]);
      return;
    }

    try {
      const data = await ApiService.getDashboard();

      const pending = data.recent_requests
        .filter((request) => request.status === 'pending')
        .slice(0, 5);

      setPendingCount(data.status_counts?.pending || 0);
      setPendingNotifications(pending);
    } catch {
      setPendingCount(0);
      setPendingNotifications([]);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 flex h-screen flex-col
            border-r border-slate-200 bg-white
            transition-[width,transform] duration-200 ease-out
            lg:sticky lg:top-0 lg:translate-x-0
            ${sidebarCollapsed ? 'lg:w-[76px]' : 'w-[220px] lg:w-[220px]'}
            ${
              mobileSidebarOpen
                ? 'translate-x-0 shadow-2xl'
                : '-translate-x-full'
            }
          `}
        >
          {/* Brand */}
          <div className="relative flex h-[64px] items-center justify-center border-b border-slate-200 px-4">
            {/* Logo */}
            <img
              src="/logo.png"
              alt="UNP"
              className="h-9 w-9 object-contain"
            />

            {/* Collapse */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="absolute right-4 hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-500 lg:flex"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* Expand button when collapsed */}
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="mx-auto mt-3 hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-500 lg:flex"
              aria-label="Perbesar sidebar"
              title="Perbesar sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* Navigation */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {!sidebarCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Menu utama
              </p>
            )}

            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/dashboard'}
                    onClick={() => setMobileSidebarOpen(false)}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={({ isActive }) =>
                      `
                        relative flex h-10 items-center rounded-lg
                        text-[13px] font-medium transition-colors
                        ${
                          sidebarCollapsed
                            ? 'justify-center px-2'
                            : 'gap-3 px-3'
                        }
                        ${
                          isActive
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }
                      `
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active indicator now uses the brand navy
                            (same #0f172a as the login button and the
                            Total Permohonan card accent) instead of an
                            unrelated blue, so the active state reads
                            as "brand" rather than a stray color. */}
                        <span
                          className={`
                            absolute left-0 top-1/2 h-5 w-[2px]
                            -translate-y-1/2 rounded-r-full bg-slate-900
                            transition-opacity
                            ${isActive ? 'opacity-100' : 'opacity-0'}
                          `}
                        />

                        <Icon
                          size={18}
                          strokeWidth={1.8}
                          className={
                            isActive
                              ? 'text-slate-900'
                              : 'text-slate-500'
                          }
                        />

                        {!sidebarCollapsed && <span>{item.name}</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Logout */}
          <div className="shrink-0 border-t border-slate-200 px-3 py-3">
            <button
              type="button"
              onClick={logout}
              title={sidebarCollapsed ? 'Keluar' : undefined}
              className={`
                flex h-10 w-full items-center rounded-lg
                text-[13px] font-medium text-slate-600 transition
                hover:bg-rose-50 hover:text-rose-700
                ${
                  sidebarCollapsed
                    ? 'justify-center px-2'
                    : 'gap-3 px-3'
                }
              `}
            >
              <LogOut size={18} strokeWidth={1.8} />
              {!sidebarCollapsed && <span>Keluar</span>}
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
                aria-label="Buka menu"
              >
                <Menu size={19} />
              </button>

              <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <span className="hidden text-slate-500 sm:inline">
                  Menu Utama
                </span>

                <ChevronRight
                  size={16}
                  className="hidden shrink-0 text-slate-600 sm:block"
                />

                <span className="truncate font-semibold text-slate-900">
                  {currentPageTitle}
                </span>
              </nav>
            </div>

            {/* Topbar actions */}
            <div className="flex items-center gap-2">
              {/* Notification */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationOpen((current) => !current)}
                  className={`
                    relative flex h-9 w-9 items-center justify-center rounded-lg
                    border bg-white text-slate-600 transition
                    hover:bg-slate-50 hover:text-slate-900
                    ${
                      notificationOpen
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-slate-200'
                    }
                  `}
                  aria-label={`${pendingCount} permohonan menunggu`}
                  aria-expanded={notificationOpen}
                >
                  <Bell size={18} strokeWidth={1.8} />

                  {pendingCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Notifikasi
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {pendingCount > 0
                            ? `${pendingCount} permohonan menunggu`
                            : 'Tidak ada permohonan baru'}
                        </p>
                      </div>

                      {pendingCount > 0 && (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-50 px-2 text-[11px] font-semibold text-amber-700">
                          {pendingCount}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    {pendingNotifications.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Bell size={18} strokeWidth={1.8} />
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-700">
                          Tidak ada notifikasi
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Semua permohonan telah ditinjau.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-y-auto">
                        {pendingNotifications.map((request) => (
                          <Link
                            key={request.id}
                            to={`/dashboard/requests/${request.id}/process`}
                            onClick={() => setNotificationOpen(false)}
                            className="flex gap-3 border-b border-slate-100 px-4 py-3.5 transition last:border-b-0 hover:bg-slate-50"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                              <FileText size={17} strokeWidth={1.8} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-slate-900">
                                {request.student_name}
                              </p>

                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {request.template_name}
                              </p>

                              <p className="mt-1 text-[11px] text-slate-400">
                                {new Date(request.created_at).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>

                            <ChevronRight
                              size={16}
                              className="mt-2 shrink-0 text-slate-300"
                            />
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    {pendingCount > 0 && (
                      <Link
                        to="/dashboard/requests"
                        onClick={() => setNotificationOpen(false)}
                        className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        Lihat semua permohonan
                        <ChevronRight size={15} />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Profile */}
              <button
                type="button"
                className="flex h-9 items-center rounded-lg p-0.5 transition hover:bg-slate-100"
                aria-label="Profil administrator"
                title="Administrator"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  A
                </div>
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;