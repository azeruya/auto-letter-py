// src/services/api.ts

import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
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
  RequestItem, 
  TrackingResponse,
  DashboardStats,
  FormLayout,
} from '../types';

// Create axios instance with default config
const API_BASE_URL = 'http://localhost:8000';

interface RetryRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Always use the newest access token.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  // A separate Axios call prevents the refresh request from entering
  // the same response interceptor.
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/refresh`,
    {},
    {
      withCredentials: true,
      timeout: 30000,
    }
  );

  const newToken = response.data.access_token as string;

  localStorage.setItem('token', newToken);
  apiClient.defaults.headers.common.Authorization =
    `Bearer ${newToken}`;

  window.dispatchEvent(
    new CustomEvent('auth:token-refreshed', {
      detail: newToken,
    })
  );

  return newToken;
};

apiClient.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest =
      error.config as RetryRequestConfig | undefined;

    const statusCode = error.response?.status;
    const requestUrl = originalRequest?.url ?? '';

    const isAuthEndpoint =
      requestUrl.includes('/api/auth/login') ||
      requestUrl.includes('/api/auth/refresh');

    if (
      statusCode === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;

        originalRequest.headers.Authorization =
          `Bearer ${newToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('token');
        ApiService.clearAuthToken();

        window.dispatchEvent(
          new CustomEvent('auth:session-expired')
        );

        return Promise.reject(refreshError);
      }
    }

    const responseData = error.response?.data as
      | { detail?: string; message?: string }
      | undefined;

    const apiError: ApiError = {
      message:
        responseData?.message ||
        error.message ||
        'Network error occurred',
      detail:
        responseData?.detail ||
        responseData?.message,
    }; 

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

  static async refreshToken(): Promise<LoginResponse> {
    const response = await apiClient.post('/api/auth/refresh');
    return response.data;
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

  static async trackRequest(tracking_id: string): Promise<TrackingResponse> {
    const response = await apiClient.get(`/api/student/track/${tracking_id}`);
    return response.data;
  }

  static async getDashboard(): Promise<DashboardStats> {
    const response = await apiClient.get(
      '/api/admin/dashboard'
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

  // List requests
  static async listRequests(params: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ requests: RequestItem[]; total_count: number }> {
    const response = await apiClient.get("/api/admin/requests", { params });
    return response.data;
  }

  // Get request details
  static async getRequestDetails(id: string): Promise<any> {
    const response = await apiClient.get(`/api/admin/requests/${id}`);
    return response.data; // return { request, admin_form_schema }
  }

  // Process a request
  static async processRequest(
    id: string,
    data: { form_data: Record<string, any>; admin_notes: string }
  ) {
    const response = await apiClient.put(`/api/admin/requests/${id}/process`, data);
    return response.data;
  }

  // Generate document (complete request)
  static async generateRequest(id: string) {
    const response = await apiClient.post(`/api/admin/requests/${id}/generate`);
    return response.data;
  }

  // Reject a request
  static async rejectRequest(id: string, reason: string) {
    const response = await apiClient.post(
      `/api/admin/requests/${id}/reject`,
      { rejection_reason: reason }, // ✅ send JSON object
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data;
  }

  // services/api.ts
  static async downloadDocument(docId: string) {
    const response = await apiClient.get(`/api/admin/documents/${docId}/download`, {
      responseType: "blob",
    });

    const blob = response.data; // already a Blob
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;

    // get filename from headers if available
    const contentDisposition = response.headers["content-disposition"];
    let filename = `document_${docId}.docx`; // give default with extension
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/);
      if (match?.[1]) filename = match[1];
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Export all requests
  static async exportRequests(): Promise<Blob> {
    const response = await apiClient.get(`/api/admin/export/requests`, {
      responseType: "blob",
    });
    return response.data;
  }

  // Export selected requests
  static async exportDetailedRequests(ids: string[]): Promise<Blob> {
    const response = await apiClient.post(`/api/admin/export/requests/detailed`, ids, {
      responseType: "blob",
      headers: { "Content-Type": "application/json" },
    });
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

  static async updateFormLayout(
    templateId: string,
    layout: {
      sections: Array<{
        id: string;
        name: string;
        description?: string;
        order: number;
        fields: Array<{
          name: string;
          label: string;
          type: string;
          required: boolean;
          repeatable?: boolean;
          order: number;
          width: 'half' | 'full';
        }>;
      }>;
    }
  ) {
    const response = await apiClient.put(
      `/api/admin/templates/${templateId}/form-layout`,
      layout
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

  static async getKeperluanOptions(): Promise<{ key: string; value: string }[]> {
    const response = await apiClient.get('/api/student/keperluan');
    return response.data;
  }

}