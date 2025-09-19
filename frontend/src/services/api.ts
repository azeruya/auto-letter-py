// src/services/api.ts

import axios from 'axios';
import { 
  Template, 
  UploadResponse, 
  ListTemplatesResponse, 
  TemplateDetailResponse,
  FormDataType,
  ApiError,
  StudentFormData,
  TemplateListResponse, 
  Admin,
  ChangePasswordRequest,
  LoginResponse,
  RequestItem
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

  // admin auth
  static async login(username: string, password: string): Promise<LoginResponse> {
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);

    const response = await apiClient.post('/api/auth/login', params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return response.data as LoginResponse;
  }

  static async register(data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }): Promise<Admin> {
    const response = await apiClient.post('/api/auth/register', data);
    return response.data;
  }

  // List all admins (for admin management page)
  static async listAdmins(): Promise<Admin[]> {
    const response = await apiClient.get('/api/admin/admins'); 
    return response.data.admins;
  }

  // Register new admin (as logged-in admin)
  static async addAdmin(data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }): Promise<Admin> {
    const response = await apiClient.post('/api/auth/register', data);
    return response.data;
  }

  static async getMe() {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  }

  static async changePassword(data: ChangePasswordRequest) {
    const response = await apiClient.post("/api/auth/change-password", data);
    return response.data;
  }

  static async logout() {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  }

  // Add auth token to axios headers
  static setAuthToken(token: string) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  static clearAuthToken() {
    delete apiClient.defaults.headers.common["Authorization"];
  }

  // prev ver
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

  // List active templates for students
  static async listStudentTemplates(): Promise<TemplateListResponse> {
    const response = await apiClient.get('/api/student/templates');
    return response.data;
  }

  // Submit student request
  static async submitStudentRequest(formData: StudentFormData) {
    const response = await apiClient.post('/api/student/submit-request', formData);
    return response.data;
  }

  // Get student form schema for template
  static async getStudentFormSchema(templateId: string) {
    const response = await apiClient.get(`/api/student/templates/${templateId}/form`);
    return response.data;
  }

  // List requests with optional filters
  static async listRequests(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await apiClient.get("/api/admin/requests", { params });
    return response.data;
  }

  // Process request (admin fills form)
  static async processRequest(id: number, formData: any) {
    const response = await apiClient.put(`/api/admin/requests/${id}/process`, formData);
    return response.data;
  }

  // Generate approved request document
  static async generateRequest(id: number) {
    const response = await apiClient.post(`/api/admin/requests/${id}/generate`);
    return response.data;
  }

  // Reject request with reason
  static async rejectRequest(id: number, reason: string) {
    const response = await apiClient.post(
      `/api/admin/requests/${id}/reject`,
      { reason }, // wrapped in object for consistency
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data;
  }

  static async getRequestDetails(id: number) {
    const response = await apiClient.get(`/api/admin/requests/${id}`);
    return response.data;
  }

  static async exportRequests() {
    const response = await apiClient.get(`/api/admin/export/requests`, {
      responseType: "blob", // so we can download Excel file
    });
    return response.data;
  }

  static async exportDetailedRequests(requestIds: number[]) {
    const response = await apiClient.post(
      `/api/admin/export/requests/detailed`,
      { request_ids: requestIds },
      { responseType: "blob" }
    );
    return response.data;
  }

  // admin template management
  static async uploadTemplate(formData: FormData) {
    const response = await apiClient.post("api/admin/templates/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  static async listTemplates() {
    const response = await apiClient.get("api/admin/templates");
    return response.data;
  }

  static async getTemplateDetails(templateId: string) {
    const response = await apiClient.get(`api/admin/templates/${templateId}`);
    return response.data;
  }

  static async deleteTemplate(templateId: string) {
    const response = await apiClient.delete(`api/admin/templates/${templateId}`);
    return response.data;
  }

  static async updateTemplate(templateId: string, formData: FormData) {
    const response = await apiClient.put(`/templates/${templateId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  static async updateFieldAssignments(templateId: string, assignments: any) {
    const response = await apiClient.put(
      `api/admin/templates/${templateId}/field-assignments`,
      assignments
    );
    return response.data;
  }

  static async previewTemplate(templateId: string, sampleData: any) {
    const response = await apiClient.post(
      `api/admin/templates/${templateId}/preview`,
      sampleData
    );
    return response.data;
  }

}