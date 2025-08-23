// src/pages/TemplateDetail.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Download, ArrowLeft, FileText, Calendar, User, Mail, Phone } from 'lucide-react';
import { ApiService } from '../services/api';
import { Template, TemplateField, FormDataType } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import toast from 'react-hot-toast';

const TemplateDetail: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormDataType>();
  
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = async () => {
    if (!templateId) return;
    
    try {
      setLoading(true);
      setError(null);
      const templateData = await ApiService.getTemplate(parseInt(templateId));
      setTemplate(templateData);
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: FormDataType) => {
    if (!template) return;

    setGenerating(true);
    try {
      const blob = await ApiService.generateDocument(template.id, formData);
      const filename = `generated_${template.name}_${new Date().toISOString().slice(0, 10)}.docx`;
      ApiService.downloadBlob(blob, filename);
      toast.success('Document generated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'date':
        return <Calendar className="h-4 w-4 text-gray-400" />;
      case 'email':
        return <Mail className="h-4 w-4 text-gray-400" />;
      case 'tel':
        return <Phone className="h-4 w-4 text-gray-400" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderField = (field: TemplateField) => {
    const commonProps = {
      ...register(field.name, { 
        required: field.required ? `${field.label} is required` : false 
      }),
      className: `mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
        errors[field.name] ? 'border-red-300' : ''
      }`,
      placeholder: field.placeholder,
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            {...commonProps}
          />
        );
      case 'email':
        return (
          <input
            type="email"
            {...commonProps}
          />
        );
      case 'tel':
        return (
          <input
            type="tel"
            {...commonProps}
          />
        );
      default:
        return (
          <input
            type="text"
            {...commonProps}
          />
        );
    }
  };

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" text="Loading template..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage 
        message={error} 
        onRetry={loadTemplate}
      />
    );
  }

  if (!template) {
    return (
      <ErrorMessage message="Template not found" />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Info */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-primary-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {template.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {template.category}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Original File</dt>
                  <dd className="text-sm text-gray-900">{template.original_filename}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Fields Count</dt>
                  <dd className="text-sm text-gray-900">
                    {template.schema?.sections.reduce((total, section) => total + section.fields.length, 0) || 0}
                  </dd>
                </div>
                {template.created_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="text-sm text-gray-900">
                      {new Date(template.created_at).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Sections</h3>
              <ul className="space-y-1">
                {template.schema?.sections.map((section, index) => (
                  <li key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{section.title}</span>
                    <span className="text-gray-400">{section.fields.length}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Generate Document
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Fill in the form below to generate your document
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6">
              <div className="space-y-8">
                {template.schema?.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="space-y-6">
                    <div className="border-b border-gray-200 pb-2">
                      <h4 className="text-md font-medium text-gray-900">
                        {section.title}
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {section.fields.map((field, fieldIndex) => (
                        <div key={fieldIndex} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                          <label
                            htmlFor={field.name}
                            className="flex items-center text-sm font-medium text-gray-700"
                          >
                            {getFieldIcon(field.type)}
                            <span className="ml-2">{field.label}</span>
                            {field.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          
                          {renderField(field)}
                          
                          {errors[field.name] && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors[field.name]?.message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetail;