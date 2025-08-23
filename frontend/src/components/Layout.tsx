
// src/components/Layout.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Upload, Home } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-primary-600" />
                <span className="text-xl font-bold text-gray-900">
                  Auto Letter Generator
                </span>
              </Link>

              <div className="flex space-x-4">
                <Link
                  to="/"
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/') 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/upload"
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/upload') 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Template</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;