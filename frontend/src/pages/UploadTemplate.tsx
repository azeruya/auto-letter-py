// src/pages/UploadTemplate.tsx

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import { ApiService } from '../services/api';
import { UploadResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const UploadTemplate: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'official', label: 'Surat Resmi' },
    { value: 'academic', label: 'Akademik' },
    { value: 'business', label: 'Bisnis' },
    { value: 'personal', label: 'Personal' },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.docx')) {
        setFile(droppedFile);
        if (!templateName) {
          setTemplateName(droppedFile.name.replace('.docx', ''));
        }
      } else {
        toast.error('Please select a .docx file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.toLowerCase().endsWith('.docx')) {
        setFile(selectedFile);
        if (!templateName) {
          setTemplateName(selectedFile.name.replace('.docx', ''));
        }
      } else {
        toast.error('Please select a .docx file');
        e.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await ApiService.uploadTemplate(
        file,
        templateName || undefined,
        category
      );
      
      setUploadResult(result);
      
      if (result.success) {
        toast.success('Template uploaded successfully!');
        // Auto navigate to template view after 2 seconds
        setTimeout(() => {
          navigate(`/template/${result.template_id}`);
        }, 2000);
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
      setUploadResult({
        success: false,
        error: err.message || 'Upload failed'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTemplateName('');
    setCategory('general');
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Template</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload a .docx template with placeholders like {"{{name}}"} to create dynamic forms
        </p>
      </div>

      {/* Upload Form */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {!uploadResult && (
            <div className="space-y-6">
              {/* File Drop Zone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template File
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 ${
                    dragActive 
                      ? 'border-primary-300 bg-primary-50' 
                      : file 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    {file ? (
                      <div className="flex items-center justify-center space-x-2">
                        <File className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-green-700">
                            {file.name}
                          </p>
                          <p className="text-xs text-green-600">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-4">
                          <label htmlFor="file-upload" className="cursor-pointer">
                          <p className="mt-2 block text-sm font-medium text-gray-900">
                            Drop your .docx file here, or{' '}
                            <span className="text-primary-600 hover:text-primary-500">
                              browse
                            </span>
                          </p>
                            <input
                              ref={fileInputRef}
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept=".docx"
                              onChange={handleFileSelect}
                            />
                          </label>
                          <p className="mt-1 text-xs text-gray-500">
                            Only .docx files are supported
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Template Details */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="template-name" className="block text-sm font-medium text-gray-700">
                    Template Name
                  </label>
                  <input
                    type="text"
                    name="template-name"
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Enter template name..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to use filename
                  </p>
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Button */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Uploading...</span>
                    </>
                  ) : (
                    'Upload & Parse Template'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-4">
              {uploadResult.success ? (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Upload Successful!
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>{uploadResult.message}</p>
                        <p className="mt-1">
                          <strong>Fields detected:</strong> {uploadResult.field_count}
                        </p>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => navigate(`/template/${uploadResult.template_id}`)}
                          className="bg-green-100 px-3 py-2 rounded-md text-sm font-medium text-green-800 hover:bg-green-200"
                        >
                          View Template →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Upload Failed
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{uploadResult.error}</p>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={resetForm}
                          className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          📝 Template Instructions
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use placeholders like <code className="bg-blue-100 px-1 rounded">{'{{nama}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{tanggal}}'}</code> in your .docx file</li>
          <li>• The system will automatically detect and categorize Indonesian fields</li>
          <li>• Supported field types: text, textarea, date, email, phone number</li>
          <li>• Once uploaded, you can generate documents by filling the auto-generated form</li>
        </ul>
      </div>
    </div>
  );
}

export default UploadTemplate;