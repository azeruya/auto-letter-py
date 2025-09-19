// src/layouts/AdminDashboardLayout.tsx
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AdminDashboardLayout = () => {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 font-bold text-xl border-b border-gray-700">
          Admin Panel
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/dashboard" className="block hover:bg-gray-700 p-2 rounded">
            Dashboard
          </Link>
          <Link to="/dashboard/requests" className="block hover:bg-gray-700 p-2 rounded">
            Requests
          </Link>
          <Link to="/dashboard/templates" className="block hover:bg-gray-700 p-2 rounded">
            Templates
          </Link>
          <Link to="/dashboard/admins" className="block hover:bg-gray-700 p-2 rounded">
            Admins
          </Link>
        </nav>
        <button
          onClick={logout}
          className="bg-red-600 m-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminDashboardLayout;
