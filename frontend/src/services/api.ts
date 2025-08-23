// src/services/api.ts

import axios from 'axios';
import { 
  Template, 
  UploadResponse, 
  ListTemplatesResponse, 
  TemplateDetailResponse,
  FormDataType,
  ApiError
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError: ApiError = {
      message: 'Network error occurred',
    };

    if (error.response?.data) {
      apiError.detail = error.response.data.detail || error.response.data.message;
      apiError.message = error.response.data.message || error.message;
    }

    return Promise.reject(apiError);
  }
);

export class ApiService {
  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await apiClient.get('/health');
    return response.data;
  }

  // Template operations
  static async uploadTemplate(
    file: File, 
    name?: string, 
    category: string = 'general'
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (name) {
      formData.append('name', name);
    }
    formData.append('category', category);

    const response = await apiClient.post('/api/templates/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  static async listTemplates(): Promise<ListTemplatesResponse> {
    const response = await apiClient.get('/api/templates');
    return response.data;
  }

  static async getTemplate(templateId: number): Promise<TemplateDetailResponse> {
    const response = await apiClient.get(`/api/templates/${templateId}`);
    return response.data;
  }

  static async deleteTemplate(templateId: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/templates/${templateId}`);
    return response.data;
  }

  static async generateDocument(
    templateId: number, 
    formData: FormDataType
  ): Promise<Blob> {
    const response = await apiClient.post(
      `/api/documents/generate/${templateId}`, 
      formData,
      {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  // Utility method to download generated document
  static downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
