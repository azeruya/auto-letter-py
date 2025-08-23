// src/types/index.ts

export interface Template {
  id: number;
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
  template_id?: number;
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