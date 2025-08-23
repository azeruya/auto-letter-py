// src/pages/Dashboard.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Calendar, Trash2, Eye } from 'lucide-react';
import { ApiService } from '../services/api';
import { Template } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ApiService.listTemplates();
      setTemplates(response.templates);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${templateName}"?`)) {
      return;
    }

    try {
      await ApiService.deleteTemplate(templateId);
      toast.success('Template deleted successfully');
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" text="Loading templates..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage 
        message={error} 
        onRetry={loadTemplates}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your document templates and generate letters
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload New Template
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Templates
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {templates.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Recent Uploads
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {templates.filter(t => {
                      if (!t.created_at) return false;
                      const created = new Date(t.created_at);
                      const today = new Date();
                      const diffDays = Math.ceil((today.getTime() - created.getTime()) / (1000 * 3600 * 24));
                      return diffDays <= 7;
                    }).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Categories
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {new Set(templates.map(t => t.category)).size}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by uploading your first document template.
          </p>
          <div className="mt-6">
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Template
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {templates.map((template) => (
              <li key={template.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-primary-600 truncate">
                            {template.name}
                          </p>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {template.category}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <p>
                            {template.original_filename} • {template.field_count || 0} fields
                          </p>
                          {template.created_at && (
                            <p className="ml-4">
                              Created {new Date(template.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/template/${template.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Link>
                      <button
                        onClick={() => handleDeleteTemplate(template.id, template.name)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dashboard;