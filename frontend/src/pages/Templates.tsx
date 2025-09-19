// src/pages/Templates.tsx
import { useEffect, useState } from "react";
import { ApiService } from "../services/api";
import toast from "react-hot-toast";
import { Button, Modal, Upload, Input, Select, Switch } from "antd";
import { UploadOutlined } from "@ant-design/icons";

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

const Templates = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload modal
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");

  // Details modal
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Field assignment modal
  const [fieldAssignmentsModalVisible, setFieldAssignmentsModalVisible] = useState(false);
    const [fieldAssignments, setFieldAssignments] = useState<{
    student_fields: string[];
    admin_fields: string[];
    auto_fields: string[];
    }>({ student_fields: [], admin_fields: [], auto_fields: [] });
  const [fieldAssignmentsChanged, setFieldAssignmentsChanged] = useState(false);


  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await ApiService.listTemplates();
      setTemplates(data.templates);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a .docx file");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("category", category);
      formData.append("description", description);

      await ApiService.uploadTemplate(formData);
      toast.success("Template uploaded successfully");
      setUploadModalVisible(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to upload template");
    }
  };

  const handleView = async (id: string) => {
    try {
      const details = await ApiService.getTemplateDetails(id);
      setSelectedTemplate(details);
      setDetailsModalVisible(true);
    } catch (err) {
      toast.error("Failed to load template details");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this template?")) return;
    try {
      await ApiService.deleteTemplate(id);
      toast.success("Template deleted (soft delete)");
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete template");
    }
  };

  const handleFieldAssignments = async (templateId: string) => {
    try {
        const details = await ApiService.getTemplateDetails(templateId);

        setSelectedTemplate(details);
        // Preload assignments if they exist
        setFieldAssignments({
        student_fields: details.field_assignments?.student_fields || [],
        admin_fields: details.field_assignments?.admin_fields || [],
        auto_fields: details.field_assignments?.auto_fields || [],
        });

        setFieldAssignmentsModalVisible(true);
    } catch (err) {
        toast.error("Failed to load template field assignments");
    }};


  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Templates Management</h1>

      <Button type="primary" onClick={() => setUploadModalVisible(true)}>
        Upload New Template
      </Button>

      {/* Templates Table */}
      {loading ? (
        <p>Loading templates...</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300 mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Name</th>
              <th className="border p-2">Category</th>
              <th className="border p-2">Fields</th>
              <th className="border p-2">Usage</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td className="border p-2">{t.name}</td>
                <td className="border p-2">{t.category}</td>
                <td className="border p-2">{t.field_count}</td>
                <td className="border p-2">{t.usage_count}</td>
                <td className="border p-2">
                  {t.is_active ? "Active" : "Inactive"}
                </td>
                <td className="border p-2 space-x-2">
                <Button size="small" onClick={() => handleView(t.id)}>
                    View
                </Button>
                <Button size="small" onClick={() => handleFieldAssignments(t.id)}>
                    Assign Fields
                </Button>
                <Button
                    size="small"
                    danger
                    onClick={() => handleDelete(t.id)}
                >
                    Delete
                </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Upload Modal */}
      <Modal
        title="Upload Template"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        onOk={handleUpload}
      >
        <Upload
          beforeUpload={(file) => {
            setFile(file);
            return false; // prevent auto upload
          }}
          maxCount={1}
        >
          <Button icon={<UploadOutlined />}>Select .docx File</Button>
        </Upload>
        <Input
          placeholder="Template Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2"
        />
        <Input.TextArea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2"
        />
        <Select
          value={category}
          onChange={(val) => setCategory(val)}
          className="mt-2 w-full"
        >
          <Select.Option value="general">General</Select.Option>
          <Select.Option value="academic">Academic</Select.Option>
          <Select.Option value="administrative">Administrative</Select.Option>
        </Select>
      </Modal>

      {/* Details Modal */}
      <Modal
        title="Template Details"
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
      >
        {selectedTemplate ? (
          <div className="space-y-2">
            <p><b>ID:</b> {selectedTemplate.id}</p>
            <p><b>Name:</b> {selectedTemplate.name}</p>
            <p><b>Description:</b> {selectedTemplate.description}</p>
            <p><b>Category:</b> {selectedTemplate.category}</p>
            <p><b>Original File:</b> {selectedTemplate.original_filename}</p>
            <p><b>Fields:</b> {selectedTemplate.placeholders?.join(", ")}</p>
            <p><b>Is Active:</b> {selectedTemplate.is_active ? "Yes" : "No"}</p>
            <p><b>Created At:</b> {new Date(selectedTemplate.created_at).toLocaleString()}</p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </Modal>

      {/* Field Assignment Modal */}
      <Modal
        title={`Assign Fields for ${selectedTemplate?.name}`}
        open={fieldAssignmentsModalVisible}
        onCancel={() => setFieldAssignmentsModalVisible(false)}
        okButtonProps={{ disabled: !fieldAssignmentsChanged }} // disabled until change
        onOk={async () => {
            try {
            await ApiService.updateFieldAssignments(selectedTemplate.id, fieldAssignments);
            toast.success("Field assignments updated successfully");
            setFieldAssignmentsModalVisible(false);
            setFieldAssignmentsChanged(false); // reset after save
            } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to update field assignments");
            }
        }}
        >
        {selectedTemplate?.placeholders?.map((field: string) => {
            let assignment: "student" | "admin" | "auto" | null = null;
            if (fieldAssignments.student_fields.includes(field)) assignment = "student";
            else if (fieldAssignments.admin_fields.includes(field)) assignment = "admin";
            else if (fieldAssignments.auto_fields.includes(field)) assignment = "auto";

            return (
            <div key={field} className="flex items-center justify-between mb-2">
                <span>{field}</span>
                <Select
                value={assignment}
                onChange={(val: "student" | "admin" | "auto") => {
                    setFieldAssignments((prev) => {
                    const newAssignments = {
                        student_fields: prev.student_fields.filter((f) => f !== field),
                        admin_fields: prev.admin_fields.filter((f) => f !== field),
                        auto_fields: prev.auto_fields.filter((f) => f !== field),
                    };
                    if (val === "student") newAssignments.student_fields.push(field);
                    else if (val === "admin") newAssignments.admin_fields.push(field);
                    else if (val === "auto") newAssignments.auto_fields.push(field);

                    setFieldAssignmentsChanged(true);
                    return newAssignments;
                    });
                }}
                style={{ width: 150 }}
                >
                <Select.Option value="student">Student</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
                <Select.Option value="auto">Auto</Select.Option>
                </Select>
            </div>
            );
        })}
        </Modal>
    </div>
  );
};

export default Templates;
