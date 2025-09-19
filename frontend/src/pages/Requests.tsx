// src/pages/Requests.tsx
import { useEffect, useState } from "react";
import { ApiService } from "../services/api";
import toast from "react-hot-toast";
import { Button, Modal, message } from "antd";

type RequestItem = {
  id: number;
  tracking_id: string;
  student: { nama: string; nim: string; email: string; program_studi: string };
  template: { id: number; name: string };
  keperluan: string;
  status: string;
  created_at: string;
  admin_notes?: string;
};

const Requests = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed" | "rejected"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState(0);

  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(
    null
  );
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await ApiService.listRequests({
        status: filter === "all" ? undefined : filter,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });
      setRequests(data.requests);
      setTotalCount(data.total_count);
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || err.message || "Failed to load requests"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (id: number) => {
    try {
      await ApiService.processRequest(id, { form_data: {}, admin_notes: "" });
      toast.success("Request moved to in-progress");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to process request");
    }
  };

  const handleGenerate = async (id: number) => {
    try {
      await ApiService.generateRequest(id);
      toast.success("Request completed & document generated");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to generate document");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    try {
      await ApiService.rejectRequest(id, reason);
      toast.success("Request rejected");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to reject request");
    }
  };

  const handleView = async (id: number) => {
    try {
      const details = await ApiService.getRequestDetails(id);
      setSelectedRequest(details);
      setDetailsModalVisible(true);
    } catch (error) {
      message.error("Failed to load request details");
    }
  };

  const handleExportAll = async () => {
    try {
      const blob = await ApiService.exportRequests();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "requests.xlsx");
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error("Failed to export requests");
    }
  };

  const handleExportSelected = async () => {
    try {
      const ids = requests.map((r) => r.id);
      const blob = await ApiService.exportDetailedRequests(ids);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "requests_detailed.xlsx");
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error("Failed to export detailed requests");
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter, currentPage]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Requests Management</h1>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-6">
        {["all", "pending", "in_progress", "completed", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f as typeof filter);
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded ${
              filter === f
                ? "bg-blue-500 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {f.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {/* Export Buttons */}
      <div className="flex space-x-2 mb-4">
        <Button type="primary" onClick={handleExportAll}>
          Export All
        </Button>
        <Button onClick={handleExportSelected}>Export Detailed</Button>
      </div>

      {/* Requests Table */}
      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">No {filter} requests found.</p>
      ) : (
        <>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Student</th>
                <th className="border p-2">Template</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Created At</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2">{r.student.nama}</td>
                  <td className="border p-2">{r.template.name}</td>
                  <td className="border p-2 capitalize">
                    {r.status.replace("_", " ")}
                  </td>
                  <td className="border p-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="border p-2 space-x-2">
                    <button
                      onClick={() => handleView(r.id)}
                      className="bg-blue-500 text-white px-3 py-1 rounded"
                    >
                      View
                    </button>
                    {r.status === "pending" && (
                      <button
                        onClick={() => handleProcess(r.id)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                      >
                        Process
                      </button>
                    )}
                    {r.status === "in_progress" && (
                      <button
                        onClick={() => handleGenerate(r.id)}
                        className="bg-green-500 text-white px-3 py-1 rounded"
                      >
                        Generate
                      </button>
                    )}
                    {["pending", "in_progress"].includes(r.status) && (
                      <button
                        onClick={() => handleReject(r.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded"
                      >
                        Reject
                      </button>
                    )}
                    {["completed", "rejected"].includes(r.status) && (
                      <span className="text-gray-500">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="flex justify-center items-center mt-4 space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className={`px-3 py-1 rounded ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className={`px-3 py-1 rounded ${
                currentPage === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Details Modal */}
      <Modal
        title="Request Details"
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
      >
        {selectedRequest ? (
          <div className="space-y-2">
            <p>
              <b>ID:</b> {selectedRequest.id}
            </p>
            <p>
              <b>Tracking ID:</b> {selectedRequest.tracking_id}
            </p>
            <p>
              <b>Student:</b> {selectedRequest.student.nama} (
              {selectedRequest.student.nim})
            </p>
            <p>
              <b>Email:</b> {selectedRequest.student.email}
            </p>
            <p>
              <b>Program Studi:</b> {selectedRequest.student.program_studi}
            </p>
            <p>
              <b>Template:</b> {selectedRequest.template.name}
            </p>
            <p>
              <b>Keperluan:</b> {selectedRequest.keperluan}
            </p>
            <p>
              <b>Status:</b> {selectedRequest.status}
            </p>
            <p>
              <b>Admin Notes:</b> {selectedRequest.admin_notes || "-"}
            </p>
            <p>
              <b>Created At:</b>{" "}
              {new Date(selectedRequest.created_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </Modal>
    </div>
  );
};

export default Requests;
