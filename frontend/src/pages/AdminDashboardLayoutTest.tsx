// src/pages/AdminDashboardLayoutTest.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Menu, Home, FileText, Users, Layers } from "lucide-react";
import { useState } from "react";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
  { name: "Requests", path: "/dashboard/requests", icon: <FileText className="h-5 w-5" /> },
  { name: "Templates", path: "/dashboard/templates", icon: <Layers className="h-5 w-5" /> },
  { name: "Admins", path: "/dashboard/admins", icon: <Users className="h-5 w-5" /> },
];

const AdminDashboardLayout: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === path
      : location.pathname.startsWith(path);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white border-r shadow-sm transition-all duration-300 
          ${sidebarOpen ? "w-64" : "w-20"}`}
      >
        {/* Top */}
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <span className={`font-bold text-lg text-gray-800 ${!sidebarOpen && "hidden"}`}>
            Admin Panel
          </span>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center space-x-3 p-2 rounded-lg transition-colors 
                ${
                  isActive(item.path)
                    ? "bg-indigo-100 text-indigo-600 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
            >
              {item.icon}
              <span className={`${!sidebarOpen && "hidden"} text-sm font-medium`}>
                {item.name}
              </span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t">
          <button
            onClick={logout}
            className="flex items-center justify-center w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <span className={`${!sidebarOpen && "hidden"}`}>Logout</span>
            {!sidebarOpen && <span>🚪</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Removed the header here */}

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardLayout;
