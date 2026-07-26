import { useEffect, useState, type ReactNode } from 'react';
import { ApiService } from '../services/api';
import toast from 'react-hot-toast';
import { Modal, Upload, Input, Select } from 'antd';
import LoadingSpinner from '../components/LoadingSpinner';

import {
  Eye,
  Trash2,
  SlidersHorizontal,
  Upload as UploadIcon,
  Plus,
  Copy,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from 'lucide-react';

type TemplateItem = {
  id: string;
  name: string;
  category: string;
  original_filename: string;
  field_count: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FieldAssignmentType = 'student' | 'admin' | 'auto';

type LayoutField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  repeatable?: boolean;
  order: number;
  width: 'half' | 'full';
};

type LayoutSection = {
  id: string;
  name: string;
  description?: string;
  order: number;
  fields: LayoutField[];
};

type FormLayout = {
  sections: LayoutSection[];
};

type DesignTab = 'assignment' | 'layout';

// Local navy override for antd's default-blue OK buttons — belt and
// suspenders until ConfigProvider's colorPrimary token is set app-wide.
const navyOkButtonProps = {
  style: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
};

type AssignmentTabProps = {
  selectedTemplate: any;
  fieldAssignments: {
    student_fields: string[];
    admin_fields: string[];
    auto_fields: string[];
  };
  setFieldAssignments: React.Dispatch<
    React.SetStateAction<{
      student_fields: string[];
      admin_fields: string[];
      auto_fields: string[];
    }>
  >;
  setFieldAssignmentsChanged: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  formatFieldLabel: (value: string) => string;
};

function AssignmentTab({
  selectedTemplate,
  fieldAssignments,
  setFieldAssignments,
  setFieldAssignmentsChanged,
  formatFieldLabel,
}: AssignmentTabProps) {
  const total = selectedTemplate.placeholders.length;

  const assignedCount =
    fieldAssignments.student_fields.length +
    fieldAssignments.admin_fields.length +
    fieldAssignments.auto_fields.length;

  const complete = assignedCount === total;

  const assignmentStyles: Record<
    FieldAssignmentType,
    string
  > = {
    student: 'bg-indigo-500',
    admin: 'bg-slate-900',
    auto: 'bg-teal-500',
  };

  return (
    <div>
      <div
        className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium ${
          complete
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            complete
              ? 'bg-emerald-500'
              : 'bg-amber-500'
          }`}
        />

        {assignedCount} dari {total} field ditugaskan

        {!complete &&
          ' — lengkapi sisanya sebelum menyimpan'}
      </div>

      <div className="max-h-[52vh] overflow-y-auto pr-2">
        {selectedTemplate.placeholders.map(
          (placeholder: string) => {
            const label =
              formatFieldLabel(placeholder);

            let assignment:
              | FieldAssignmentType
              | undefined;

            if (
              fieldAssignments.student_fields.includes(
                placeholder
              )
            ) {
              assignment = 'student';
            } else if (
              fieldAssignments.admin_fields.includes(
                placeholder
              )
            ) {
              assignment = 'admin';
            } else if (
              fieldAssignments.auto_fields.includes(
                placeholder
              )
            ) {
              assignment = 'auto';
            }

            return (
              <div
                key={placeholder}
                className={`flex items-center justify-between gap-3 border-b border-slate-100 px-2 py-2.5 last:border-b-0 ${
                  !assignment
                    ? 'bg-amber-50/60'
                    : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      assignment
                        ? assignmentStyles[assignment]
                        : 'bg-amber-400'
                    }`}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-700">
                      {label}
                    </p>

                    <p className="truncate font-mono text-[10px] text-slate-400">
                      {placeholder}
                    </p>
                  </div>
                </div>

                <Select
                  value={assignment}
                  placeholder="Pilih"
                  onChange={(
                    value: FieldAssignmentType
                  ) => {
                    setFieldAssignments(
                      (previous) => {
                        const updated = {
                          student_fields:
                            previous.student_fields.filter(
                              (field) =>
                                field !== placeholder
                            ),
                          admin_fields:
                            previous.admin_fields.filter(
                              (field) =>
                                field !== placeholder
                            ),
                          auto_fields:
                            previous.auto_fields.filter(
                              (field) =>
                                field !== placeholder
                            ),
                        };

                        if (value === 'student') {
                          updated.student_fields.push(
                            placeholder
                          );
                        } else if (value === 'admin') {
                          updated.admin_fields.push(
                            placeholder
                          );
                        } else {
                          updated.auto_fields.push(
                            placeholder
                          );
                        }

                        return updated;
                      }
                    );

                    setFieldAssignmentsChanged(true);
                  }}
                  style={{ width: 160 }}
                >
                  <Select.Option value="student">
                    Mahasiswa
                  </Select.Option>

                  <Select.Option value="admin">
                    Admin
                  </Select.Option>

                  <Select.Option value="auto">
                    Otomatis
                  </Select.Option>
                </Select>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

const Templates = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload modal
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');

  // Details modal
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Field assignment modal
  const [fieldAssignmentsModalVisible, setFieldAssignmentsModalVisible] =
    useState(false);
  const [fieldAssignments, setFieldAssignments] = useState<{
    student_fields: string[];
    admin_fields: string[];
    auto_fields: string[];
  }>({ student_fields: [], admin_fields: [], auto_fields: [] });
  const [fieldAssignmentsChanged, setFieldAssignmentsChanged] =
    useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const [designTab, setDesignTab] =
    useState<DesignTab>('assignment');

  const [formLayout, setFormLayout] =
    useState<FormLayout>({ sections: [] });

  const [formLayoutChanged, setFormLayoutChanged] =
    useState(false);

  const [savingLayout, setSavingLayout] =
    useState(false);

  const [expandedSections, setExpandedSections] =
    useState<Record<string, boolean>>({});

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await ApiService.listTemplates();
      setTemplates(data.templates);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal memuat template');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleUpload = async () => {
    if (!file) return toast.error('Pilih file .docx terlebih dahulu');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('category', category);
      formData.append('description', description);
      await ApiService.uploadTemplate(formData);
      toast.success('Template berhasil diunggah');
      setUploadModalVisible(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal mengunggah template');
    }
  };

  const handleView = async (id: string) => {
    try {
      const details = await ApiService.getTemplateDetails(id);
      setSelectedTemplate(details);
      setDetailsModalVisible(true);
    } catch {
      toast.error('Gagal memuat detail template');
    }
  };

  // Delete confirmation — was a native confirm() dialog, same issue
  // as the old alert()s: unstyleable browser chrome. templateToDelete
  // holds the row so the modal can show its name in the confirmation.
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (template: TemplateItem) => {
    setTemplateToDelete(template);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      setDeleting(true);
      await ApiService.deleteTemplate(templateToDelete.id);
      toast.success('Template dihapus (soft delete)');
      setDeleteModalVisible(false);
      setTemplateToDelete(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus template');
    } finally {
      setDeleting(false);
    }
  };

  const createSectionId = () =>
    `section-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const normalizeFormLayout = (
    schema: any,
    placeholders: string[] = []
  ): FormLayout => {
    const sourceSections = Array.isArray(schema?.sections)
      ? schema.sections
      : [];

    const normalizedSections: LayoutSection[] =
      sourceSections.map((section: any, sectionIndex: number) => ({
        id:
          section.id ||
          `section-${sectionIndex}-${String(
            section.name || 'bagian'
          )
            .toLowerCase()
            .replace(/\s+/g, '-')}`,

        name: section.name || section.title || 'Bagian',

        description: section.description || '',

        order: section.order ?? sectionIndex,

        fields: Array.isArray(section.fields)
          ? section.fields.map(
              (field: any, fieldIndex: number): LayoutField => ({
                name:
                  typeof field === 'string'
                    ? field
                    : field.name,

                label:
                  typeof field === 'string'
                    ? formatFieldLabel(field)
                    : field.label ||
                      formatFieldLabel(field.name),

                type:
                  typeof field === 'string'
                    ? 'text'
                    : field.type || 'text',

                required:
                  typeof field === 'string'
                    ? true
                    : field.required ?? true,

                repeatable:
                  typeof field === 'string'
                    ? field.startsWith('row.')
                    : field.repeatable ?? false,

                order:
                  typeof field === 'string'
                    ? fieldIndex
                    : field.order ?? fieldIndex,

                width:
                  typeof field === 'string'
                    ? field.startsWith('row.')
                      ? 'full'
                      : 'half'
                    : field.width ||
                      (field.repeatable ||
                      field.type === 'textarea'
                        ? 'full'
                        : 'half'),
              })
            )
          : [],
      }));

    const fieldsAlreadyInLayout = new Set(
      normalizedSections.flatMap((section) =>
        section.fields.map((field) => field.name)
      )
    );

    const unplacedFields = placeholders.filter(
      (placeholder) =>
        !fieldsAlreadyInLayout.has(placeholder)
    );

    if (unplacedFields.length > 0) {
      const otherSection =
        normalizedSections.find(
          (section) =>
            section.name.toLowerCase() === 'lainnya'
        ) ?? {
          id: createSectionId(),
          name: 'Lainnya',
          description: '',
          order: normalizedSections.length,
          fields: [],
        };

      if (!normalizedSections.includes(otherSection)) {
        normalizedSections.push(otherSection);
      }

      unplacedFields.forEach((placeholder, index) => {
        otherSection.fields.push({
          name: placeholder,
          label: formatFieldLabel(placeholder),
          type: 'text',
          required: true,
          repeatable: placeholder.startsWith('row.'),
          order: otherSection.fields.length + index,
          width: placeholder.startsWith('row.')
            ? 'full'
            : 'half',
        });
      });
    }

    return {
      sections: normalizedSections
        .sort((a, b) => a.order - b.order)
        .map((section, sectionIndex) => ({
          ...section,
          order: sectionIndex,
          fields: [...section.fields]
            .sort((a, b) => a.order - b.order)
            .map((field, fieldIndex) => ({
              ...field,
              order: fieldIndex,
            })),
        })),
    };
  };

  const handleFieldAssignments = async (
    templateId: string
  ) => {
    try {
      const details =
        await ApiService.getTemplateDetails(templateId);

      setSelectedTemplate(details);

      setFieldAssignments({
        student_fields:
          details.field_assignments?.student_fields || [],
        admin_fields:
          details.field_assignments?.admin_fields || [],
        auto_fields:
          details.field_assignments?.auto_fields || [],
      });

      const normalizedLayout = normalizeFormLayout(
        details.schema,
        details.placeholders || []
      );

      setFormLayout(normalizedLayout);

      setExpandedSections(
        Object.fromEntries(
          normalizedLayout.sections.map((section) => [
            section.id,
            true,
          ])
        )
      );

      setDesignTab('assignment');
      setFieldAssignmentsChanged(false);
      setFormLayoutChanged(false);
      setFieldAssignmentsModalVisible(true);
    } catch (err: any) {
      toast.error(
        err?.detail ||
          err?.message ||
          'Gagal memuat konfigurasi template'
      );
    }
  };

  const updateLayoutSection = (
    sectionId: string,
    changes: Partial<LayoutSection>
  ) => {
    setFormLayout((previous) => ({
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? { ...section, ...changes }
          : section
      ),
    }));

    setFormLayoutChanged(true);
  };

  const addLayoutSection = () => {
    const newSection: LayoutSection = {
      id: createSectionId(),
      name: 'Bagian Baru',
      description: '',
      order: formLayout.sections.length,
      fields: [],
    };

    setFormLayout((previous) => ({
      sections: [...previous.sections, newSection],
    }));

    setExpandedSections((previous) => ({
      ...previous,
      [newSection.id]: true,
    }));

    setFormLayoutChanged(true);
  };

  const removeLayoutSection = (
    sectionId: string
  ) => {
    const section = formLayout.sections.find(
      (item) => item.id === sectionId
    );

    if (!section) return;

    if (section.fields.length > 0) {
      toast.error(
        'Pindahkan semua field sebelum menghapus bagian ini.'
      );
      return;
    }

    setFormLayout((previous) => ({
      sections: previous.sections
        .filter((item) => item.id !== sectionId)
        .map((item, index) => ({
          ...item,
          order: index,
        })),
    }));

    setFormLayoutChanged(true);
  };

  const moveLayoutSection = (
    sectionId: string,
    direction: 'up' | 'down'
  ) => {
    setFormLayout((previous) => {
      const sections = [...previous.sections];
      const currentIndex = sections.findIndex(
        (section) => section.id === sectionId
      );

      if (currentIndex < 0) return previous;

      const targetIndex =
        direction === 'up'
          ? currentIndex - 1
          : currentIndex + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= sections.length
      ) {
        return previous;
      }

      [sections[currentIndex], sections[targetIndex]] = [
        sections[targetIndex],
        sections[currentIndex],
      ];

      return {
        sections: sections.map((section, index) => ({
          ...section,
          order: index,
        })),
      };
    });

    setFormLayoutChanged(true);
  };

  const updateLayoutField = (
    sectionId: string,
    fieldName: string,
    changes: Partial<LayoutField>
  ) => {
    setFormLayout((previous) => ({
      sections: previous.sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              fields: section.fields.map((field) =>
                field.name === fieldName
                  ? { ...field, ...changes }
                  : field
              ),
            }
      ),
    }));

    setFormLayoutChanged(true);
  };

  const moveFieldToSection = (
    sourceSectionId: string,
    fieldName: string,
    targetSectionId: string
  ) => {
    if (sourceSectionId === targetSectionId) return;

    setFormLayout((previous) => {
      let movingField: LayoutField | undefined;

      const withoutField = previous.sections.map(
        (section) => {
          if (section.id !== sourceSectionId) {
            return section;
          }

          movingField = section.fields.find(
            (field) => field.name === fieldName
          );

          return {
            ...section,
            fields: section.fields
              .filter(
                (field) => field.name !== fieldName
              )
              .map((field, index) => ({
                ...field,
                order: index,
              })),
          };
        }
      );

      if (!movingField) return previous;

      return {
        sections: withoutField.map((section) => {
          if (section.id !== targetSectionId) {
            return section;
          }

          return {
            ...section,
            fields: [
              ...section.fields,
              {
                ...movingField!,
                order: section.fields.length,
              },
            ],
          };
        }),
      };
    });

    setFormLayoutChanged(true);
  };

  const moveFieldWithinSection = (
    sectionId: string,
    fieldName: string,
    direction: 'up' | 'down'
  ) => {
    setFormLayout((previous) => ({
      sections: previous.sections.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        const fields = [...section.fields];
        const currentIndex = fields.findIndex(
          (field) => field.name === fieldName
        );

        const targetIndex =
          direction === 'up'
            ? currentIndex - 1
            : currentIndex + 1;

        if (
          currentIndex < 0 ||
          targetIndex < 0 ||
          targetIndex >= fields.length
        ) {
          return section;
        }

        [fields[currentIndex], fields[targetIndex]] = [
          fields[targetIndex],
          fields[currentIndex],
        ];

        return {
          ...section,
          fields: fields.map((field, index) => ({
            ...field,
            order: index,
          })),
        };
      }),
    }));

    setFormLayoutChanged(true);
  };

  const formatFieldLabel = (raw: string) =>
    raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const saveFieldAssignments = async () => {
    if (!selectedTemplate) return;

    try {
      setSavingAssignments(true);

      await ApiService.updateFieldAssignments(
        selectedTemplate.id,
        fieldAssignments
      );

      toast.success(
        'Penugasan field berhasil diperbarui'
      );

      setFieldAssignmentsChanged(false);
    } catch (err: any) {
      toast.error(
        err?.detail ||
          err?.message ||
          'Gagal memperbarui penugasan field'
      );
    } finally {
      setSavingAssignments(false);
    }
  };

  const saveFormLayout = async () => {
    if (!selectedTemplate) return;

    const hasEmptySectionName =
      formLayout.sections.some(
        (section) => !section.name.trim()
      );

    if (hasEmptySectionName) {
      toast.error('Nama bagian tidak boleh kosong.');
      return;
    }

    const totalLayoutFields =
      formLayout.sections.reduce(
        (total, section) =>
          total + section.fields.length,
        0
      );

    if (
      totalLayoutFields !==
      selectedTemplate.placeholders.length
    ) {
      toast.error(
        'Setiap field harus berada dalam satu bagian.'
      );
      return;
    }

    try {
      setSavingLayout(true);

      const normalizedLayout: FormLayout = {
        sections: formLayout.sections.map(
          (section, sectionIndex) => ({
            ...section,
            name: section.name.trim(),
            description:
              section.description?.trim() || '',
            order: sectionIndex,
            fields: section.fields.map(
              (field, fieldIndex) => ({
                ...field,
                order: fieldIndex,
              })
            ),
          })
        ),
      };

      await ApiService.updateFormLayout(
        selectedTemplate.id,
        normalizedLayout
      );

      setFormLayout(normalizedLayout);
      setFormLayoutChanged(false);

      toast.success(
        'Tata letak formulir berhasil disimpan'
      );
    } catch (err: any) {
      toast.error(
        err?.detail ||
          err?.message ||
          'Gagal menyimpan tata letak formulir'
      );
    } finally {
      setSavingLayout(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Action bar — no page title here since the layout's top bar
          already shows "Template Surat"; repeating it would just be
          the same label twice on screen. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setUploadModalVisible(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus size={15} strokeWidth={2} />
          Unggah Template
        </button>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <LoadingSpinner size="lg" text="Memuat template..." />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">
              Belum ada template
            </p>
            <p className="mt-1 text-[13px] text-slate-400">
              Unggah file .docx untuk membuat template pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Nama
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Kategori
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Field
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Digunakan
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-slate-900">
                        {t.name}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {t.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-slate-600">
                      {t.field_count}
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-slate-600">
                      {t.usage_count}
                    </td>

                    <td className="px-5 py-3.5">
                      {t.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Nonaktif
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Lihat Detail"
                          onClick={() => handleView(t.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <Eye size={14} strokeWidth={1.8} />
                        </button>

                        <button
                          type="button"
                          title="Atur Field"
                          onClick={() => handleFieldAssignments(t.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <SlidersHorizontal size={14} strokeWidth={1.8} />
                        </button>

                        <button
                          type="button"
                          title="Hapus"
                          onClick={() => openDeleteModal(t)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upload Modal */}
      <Modal
        title={
          <span className="text-[15px] font-semibold text-slate-900">
            Unggah Template
          </span>
        }
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        onOk={handleUpload}
        okText="Unggah"
        cancelText="Batal"
        okButtonProps={navyOkButtonProps}
      >
        <div className="space-y-3 pt-1">
          <Upload
            beforeUpload={(file) => {
              setFile(file);
              return false;
            }}
            maxCount={1}
          >
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <UploadIcon size={14} strokeWidth={1.8} />
              Pilih File .docx
            </button>
          </Upload>

          <Input
            placeholder="Nama Template"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input.TextArea
            placeholder="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Select
            value={category}
            onChange={(val) => setCategory(val)}
            className="w-full"
          >
            <Select.Option value="general">Umum</Select.Option>
            <Select.Option value="academic">Akademik</Select.Option>
            <Select.Option value="administrative">Administratif</Select.Option>
          </Select>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        title={
          <span className="text-[15px] font-semibold text-slate-900">
            Detail Template
          </span>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
        width={600}
        centered
      >
        {selectedTemplate ? (
          (() => {
            const copyToClipboard = (value: string, label: string) => {
              navigator.clipboard.writeText(value);
              toast.success(`${label} disalin`);
            };

            // Same pattern as the Requests.tsx details modal — one
            // label/value component instead of ad hoc inline sentences.
            const Field = ({
              label,
              value,
            }: {
              label: string;
              value: ReactNode;
            }) => (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-900">{value}</p>
              </div>
            );

            return (
              <div className="space-y-5">
                {/* Header: name + status, the two things read first */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {selectedTemplate.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {selectedTemplate.description || 'Tidak ada deskripsi'}
                    </p>
                  </div>

                  {selectedTemplate.is_active ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Nonaktif
                    </span>
                  )}
                </div>

                {/* ID — de-emphasized monospace chip with copy button,
                    same treatment as Tracking ID in Requests.tsx */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedTemplate.id, 'ID')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  title="Salin ID"
                >
                  <span className="font-mono">{selectedTemplate.id}</span>
                  <Copy size={12} strokeWidth={1.8} />
                </button>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field
                    label="Kategori"
                    value={
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {selectedTemplate.category}
                      </span>
                    }
                  />
                  <Field
                    label="Dibuat Pada"
                    value={formatDate(selectedTemplate.created_at)}
                  />
                  <div className="col-span-2">
                    <Field
                      label="File Asli"
                      value={selectedTemplate.original_filename}
                    />
                  </div>
                  <div className="col-span-2">
                    <Field
                      label="Field"
                      value={
                        selectedTemplate.placeholders?.length
                          ? selectedTemplate.placeholders
                              .map((ph: string) => formatFieldLabel(ph))
                              .join(', ')
                          : '—'
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <p className="text-[13px] text-slate-500">Memuat...</p>
        )}
      </Modal>

      {/* Delete confirmation — replaces native confirm() */}
      <Modal
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setTemplateToDelete(null);
        }}
        footer={null}
        width={420}
        centered
      >
        <div className="flex flex-col items-center pt-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle size={20} strokeWidth={1.8} />
          </div>

          <h3 className="mt-3 text-[15px] font-semibold text-slate-900">
            Nonaktifkan template ini?
          </h3>

          <p className="mt-1.5 text-[13px] text-slate-500">
            <span className="font-medium text-slate-700">
              {templateToDelete?.name}
            </span>{' '}
            akan dinonaktifkan dan tidak lagi tersedia untuk permohonan baru.
            Tindakan ini dapat dibatalkan nanti melalui pengaturan template.
          </p>

          <div className="mt-5 flex w-full gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteModalVisible(false);
                setTemplateToDelete(null);
              }}
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-10 flex-1 rounded-lg bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Menonaktifkan...' : 'Nonaktifkan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Field Assignment Modal */}
      <Modal
        title={
          <div>
            <p className="text-[15px] font-semibold text-slate-900">
              Desain Formulir
            </p>

            <p className="mt-0.5 text-xs font-normal text-slate-500">
              {selectedTemplate?.name}
            </p>
          </div>
        }
        open={fieldAssignmentsModalVisible}
        onCancel={() => {
          setFieldAssignmentsModalVisible(false);
          setDesignTab('assignment');
        }}
        footer={null}
        width={760}
        centered
        destroyOnClose
      >
        {selectedTemplate?.placeholders?.length ? (
          <div className="flex flex-col">
            {/* Tabs */}
            <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDesignTab('assignment')}
                className={`flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                  designTab === 'assignment'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Penugasan Field
              </button>

              <button
                type="button"
                onClick={() => setDesignTab('layout')}
                className={`flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                  designTab === 'layout'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tata Letak Formulir
              </button>
            </div>

            {designTab === 'assignment' ? (
              <AssignmentTab
                selectedTemplate={selectedTemplate}
                fieldAssignments={fieldAssignments}
                setFieldAssignments={setFieldAssignments}
                setFieldAssignmentsChanged={
                  setFieldAssignmentsChanged
                }
                formatFieldLabel={formatFieldLabel}
              />
            ) : (
              <div className="max-h-[58vh] overflow-y-auto pr-1">
                {/* Layout heading */}
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Bagian Formulir
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Atur nama bagian, keterangan, urutan,
                      dan posisi setiap field.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addLayoutSection}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Plus size={15} />
                    Tambah bagian
                  </button>
                </div>

                <div className="space-y-3">
                  {formLayout.sections.map(
                    (section, sectionIndex) => {
                      const isExpanded =
                        expandedSections[section.id] ?? true;

                      return (
                        <section
                          key={section.id}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                        >
                          {/* Section header */}
                          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSections(
                                  (previous) => ({
                                    ...previous,
                                    [section.id]: !isExpanded,
                                  })
                                )
                              }
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800"
                            >
                              {isExpanded ? (
                                <ChevronDown size={17} />
                              ) : (
                                <ChevronRight size={17} />
                              )}
                            </button>

                            <GripVertical
                              size={17}
                              className="shrink-0 text-slate-300"
                            />

                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={section.name}
                                onChange={(event) =>
                                  updateLayoutSection(
                                    section.id,
                                    {
                                      name: event.target.value,
                                    }
                                  )
                                }
                                className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] font-semibold text-slate-900 outline-none transition hover:border-slate-200 hover:bg-white focus:border-slate-300 focus:bg-white"
                                placeholder="Nama bagian"
                              />
                            </div>

                            <span className="shrink-0 text-xs text-slate-400">
                              {section.fields.length} field
                            </span>

                            <button
                              type="button"
                              disabled={sectionIndex === 0}
                              onClick={() =>
                                moveLayoutSection(
                                  section.id,
                                  'up'
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Naikkan bagian"
                            >
                              <ArrowUp size={15} />
                            </button>

                            <button
                              type="button"
                              disabled={
                                sectionIndex ===
                                formLayout.sections.length - 1
                              }
                              onClick={() =>
                                moveLayoutSection(
                                  section.id,
                                  'down'
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Turunkan bagian"
                            >
                              <ArrowDown size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                removeLayoutSection(section.id)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Hapus bagian"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="p-4">
                              {/* Description */}
                              <div className="mb-4">
                                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                  Deskripsi bagian
                                </label>

                                <input
                                  type="text"
                                  value={
                                    section.description || ''
                                  }
                                  onChange={(event) =>
                                    updateLayoutSection(
                                      section.id,
                                      {
                                        description:
                                          event.target.value,
                                      }
                                    )
                                  }
                                  placeholder="Keterangan singkat, opsional"
                                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                />
                              </div>

                              {/* Fields */}
                              {section.fields.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                                  <p className="text-[13px] text-slate-400">
                                    Belum ada field dalam bagian
                                    ini.
                                  </p>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                  {section.fields.map(
                                    (field, fieldIndex) => (
                                      <div
                                        key={field.name}
                                        className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(150px,1fr)_150px_110px_auto]"
                                      >
                                        {/* Field label */}
                                        <div className="min-w-0">
                                          <p className="mb-1 text-[11px] font-medium text-slate-400">
                                            Label
                                          </p>

                                          <input
                                            type="text"
                                            value={field.label}
                                            onChange={(event) =>
                                              updateLayoutField(
                                                section.id,
                                                field.name,
                                                {
                                                  label:
                                                    event.target
                                                      .value,
                                                }
                                              )
                                            }
                                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                          />

                                          <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                                            {field.name}
                                          </p>
                                        </div>

                                        {/* Section */}
                                        <div>
                                          <p className="mb-1 text-[11px] font-medium text-slate-400">
                                            Bagian
                                          </p>

                                          <select
                                            value={section.id}
                                            onChange={(event) =>
                                              moveFieldToSection(
                                                section.id,
                                                field.name,
                                                event.target.value
                                              )
                                            }
                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                          >
                                            {formLayout.sections.map(
                                              (targetSection) => (
                                                <option
                                                  key={
                                                    targetSection.id
                                                  }
                                                  value={
                                                    targetSection.id
                                                  }
                                                >
                                                  {
                                                    targetSection.name
                                                  }
                                                </option>
                                              )
                                            )}
                                          </select>
                                        </div>

                                        {/* Width */}
                                        <div>
                                          <p className="mb-1 text-[11px] font-medium text-slate-400">
                                            Lebar
                                          </p>

                                          <select
                                            value={field.width}
                                            disabled={
                                              field.repeatable
                                            }
                                            onChange={(event) =>
                                              updateLayoutField(
                                                section.id,
                                                field.name,
                                                {
                                                  width:
                                                    event.target
                                                      .value as
                                                      | 'half'
                                                      | 'full',
                                                }
                                              )
                                            }
                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                          >
                                            <option value="half">
                                              Setengah
                                            </option>
                                            <option value="full">
                                              Penuh
                                            </option>
                                          </select>
                                        </div>

                                        {/* Order */}
                                        <div className="flex items-end gap-1">
                                          <button
                                            type="button"
                                            disabled={
                                              fieldIndex === 0
                                            }
                                            onClick={() =>
                                              moveFieldWithinSection(
                                                section.id,
                                                field.name,
                                                'up'
                                              )
                                            }
                                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                                            title="Naikkan field"
                                          >
                                            <ArrowUp
                                              size={14}
                                            />
                                          </button>

                                          <button
                                            type="button"
                                            disabled={
                                              fieldIndex ===
                                              section.fields
                                                .length -
                                                1
                                            }
                                            onClick={() =>
                                              moveFieldWithinSection(
                                                section.id,
                                                field.name,
                                                'down'
                                              )
                                            }
                                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                                            title="Turunkan field"
                                          >
                                            <ArrowDown
                                              size={14}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Modal footer */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                {designTab === 'assignment'
                  ? fieldAssignmentsChanged
                    ? 'Terdapat perubahan yang belum disimpan'
                    : 'Penugasan field tersimpan'
                  : formLayoutChanged
                    ? 'Terdapat perubahan yang belum disimpan'
                    : 'Tata letak formulir tersimpan'}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFieldAssignmentsModalVisible(false)
                  }
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={
                    designTab === 'assignment'
                      ? saveFieldAssignments
                      : saveFormLayout
                  }
                  disabled={
                    designTab === 'assignment'
                      ? !fieldAssignmentsChanged ||
                        savingAssignments
                      : !formLayoutChanged || savingLayout
                  }
                  className="inline-flex h-9 min-w-[90px] items-center justify-center rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingAssignments || savingLayout
                    ? 'Menyimpan...'
                    : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] italic text-slate-400">
            Tidak ada field pada template ini.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default Templates;