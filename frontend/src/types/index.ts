// src/types/index.ts

export interface Template {
  id: string;
  name: string;
  category: string;
  original_filename: string;
  field_count?: number;
  schema?: TemplateSchema;
  created_at?: string;
}

export interface TemplateSchema {
  sections: TemplateSection[];
}

export interface TemplateSection {
  name: string;
  title: string;
  fields: TemplateField[];
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'email' | 'tel' | 'number';
  required: boolean;
  placeholder: string;
}

export interface UploadResponse {
  success: boolean;
  template_id?: string;
  name?: string;
  field_count?: number;
  schema?: TemplateSchema;
  message?: string;
  error?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface FormDataType {
  [key: string]: string | number | Date;
}

export interface ApiError {
  detail?: string;
  message?: string;
}

export interface ListTemplatesResponse {
  templates: Template[];
}

export interface TemplateDetailResponse extends Template {
  schema: TemplateSchema;
}

// src/types/index.ts
export interface StudentFormData {
  nama: string;
  nim: string;
  email: string;
  program_studi: string;
  keperluan: string;
  template_id?: string;
  form_data?: Record<string, any>;
}

export interface TemplateItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  field_count: number;
  student_fields_count: number;
  usage_count: number;
}

export interface TemplateListResponse {
  success: boolean;
  message: string;
  templates: TemplateItem[];
  total_count: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface Admin {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;   // backend sends ISO datetime string
  last_login: string | null; // null if never logged in
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface DashboardRequestItem {
  id: string;
  tracking_id: string;
  student_name: string;
  template_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
}

export interface DashboardStats {
  status_counts: {
    pending: number;
    in_progress?: number;
    completed: number;
    rejected: number;
  };
  total_requests: number;
  pending_requests: number;
  recent_requests: DashboardRequestItem[];
  popular_templates: Array<Record<string, unknown>>;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // optional 
}

export interface RequestItem {
  id: string;
  tracking_id: string;
  student: {
    nama: string;
    nim: string;
    email: string;
    program_studi: string;
  };
  template: {
    id: string;
    name: string;
  };
  keperluan: string;
  status: "pending" | "in_progress" | "completed" | "rejected";
  student_data?: Record<string, any>;
  admin_data?: Record<string, any>;
  admin_notes?: string | null;
  created_at: string;

  generated_documents?: GeneratedDocument[];
}

export interface GeneratedDocument {
  id: string;
  filename: string;
  created_at: string;
  format?: string; // optional, since backend may or may not return it
}

export interface TrackingResponse {
  tracking_id: string;
  status: string;
  status_description: string;
  student_name: string;
  template_name: string;
  keperluan: string;
  created_at: string;
  processed_at?: string | null;
  completed_at?: string | null;
  admin_notes?: string | null;
}

export type FormFieldWidth = 'half' | 'full';

export interface FormLayoutField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  repeatable?: boolean;
  order: number;
  width: FormFieldWidth;
}

export interface FormLayoutSection {
  id: string;
  name: string;
  description?: string;
  order: number;
  fields: FormLayoutField[];
}

export interface FormLayout {
  sections: FormLayoutSection[];
}