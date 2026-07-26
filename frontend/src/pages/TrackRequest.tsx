import { useState } from "react";
import { TrackingResponse } from "../types";
import { ApiService } from "../services/api";

export default function TrackRequest() {
  const [trackingId, setTrackingId] = useState("");
  const [result, setResult] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!trackingId.trim()) {
      setError("Masukkan Tracking ID terlebih dahulu.");
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await ApiService.trackRequest(trackingId);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal mencari data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Lacak Status Permintaan Surat</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Masukkan Tracking ID (misal: REQ250923679)"
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          className="flex-1 border rounded p-2"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {loading ? "Mencari..." : "Cari"}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="border rounded-lg p-4 shadow bg-gray-50">
          <p><strong>Tracking ID:</strong> {result.tracking_id}</p>
          <p><strong>Status:</strong> {result.status}</p>
          <p className="mb-2 text-gray-600">{result.status_description}</p>
          <p><strong>Nama Mahasiswa:</strong> {result.student_name}</p>
          <p><strong>Template:</strong> {result.template_name}</p>
          <p><strong>Keperluan:</strong> {result.keperluan}</p>
          <p><strong>Diajukan:</strong> {new Date(result.created_at).toLocaleString()}</p>
          {result.processed_at && <p><strong>Diproses:</strong> {new Date(result.processed_at).toLocaleString()}</p>}
          {result.completed_at && <p><strong>Selesai:</strong> {new Date(result.completed_at).toLocaleString()}</p>}
          {result.admin_notes && (
            <p><strong>Catatan Admin:</strong> {result.admin_notes}</p>
          )}
        </div>
      )}
    </div>
  );
}