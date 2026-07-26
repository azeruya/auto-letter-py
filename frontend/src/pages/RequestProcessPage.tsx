// src/pages/RequestProcessPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ApiService } from "../services/api";
import toast from "react-hot-toast";

const RequestProcessPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState("");
  const [adminSchema, setAdminSchema] = useState<any[]>([]);

  // Update a field value
  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Guard against missing ID
  if (!id) {
    return <div className="p-6 text-red-500">Invalid request ID</div>;
  }

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await ApiService.getRequestDetails(id);

        setTemplate(data.request.template);

        // Merge student fields
        const mergedData: Record<string, string> = {};
        (data.request.template.placeholders || []).forEach((ph: string) => {
          mergedData[ph] = data.request.student_data?.[ph] || "";
        });

        // Merge admin fields
        setAdminSchema(data.admin_form_schema || []);
        (data.admin_form_schema || []).forEach((field: any) => {
          mergedData[field.name] = data.request.admin_data?.[field.name] || "";
        });

        setFormData(mergedData);
        setAdminNotes(data.request.admin_notes || "");
      } catch (err: any) {
        toast.error("Failed to load request details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
      toast.error("Invalid request ID");
      return;
    }

    try {
      await ApiService.processRequest(id, {
        form_data: formData,
        admin_notes: adminNotes,
      });
      toast.success("Request processed successfully");
      navigate("/dashboard/requests");
    } catch (err: any) {
      toast.error(err.response?.data?.detail?.message || "Failed to process request");
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto bg-white shadow rounded p-6">
      <h2 className="text-xl font-bold mb-4">
        Process Request #{id} – {template?.title}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Fields */}
        {template?.placeholders?.map((ph: string) => (
          <div key={ph}>
            <label className="block text-sm font-medium mb-1">
              {ph.replace(/_/g, " ")} (Student)
            </label>
            <input
              type="text"
              value={formData[ph] || ""}
              onChange={(e) => handleChange(ph, e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
        ))}

        {/* Admin Fields */}
        {adminSchema.map((field: any) => (
          <div key={field.name}>
            <label className="block text-sm font-medium mb-1">
              {field.label || field.name.replace(/_/g, " ")} (Admin)
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData[field.name] || ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
        ))}

        {/* Admin Notes */}
        <div>
          <label className="block text-sm font-medium mb-1">Admin Notes</label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save & Mark In Progress
        </button>
      </form>
    </div>
  );
};

export default RequestProcessPage;
