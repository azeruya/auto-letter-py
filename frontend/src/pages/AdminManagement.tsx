//src/pages/AdminManagement.tsx
import React, { useEffect, useState } from "react";
import { ApiService } from "../services/api";
import { Admin } from "../types";
import toast from "react-hot-toast";

const AdminManagement: React.FC = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
  });
  const [loading, setLoading] = useState(false); // <-- new state

  const fetchAdmins = async () => {
    try {
      const data = await ApiService.listAdmins();
      setAdmins(data);
    } catch (err: any) {
      toast.error(err.detail || err.message || "Failed to load admins");
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // start loading
    try {
      await ApiService.addAdmin(form);
      toast.success("New admin added");
      setForm({ username: "", email: "", full_name: "", password: "" });
      fetchAdmins();
    } catch (err: any) {
      toast.error(err.detail || err.message || "Failed to add admin");
    } finally {
      setLoading(false); // stop loading no matter what
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">Admin Management</h2>

      {/* Admin list */}
      <h3 className="font-semibold mb-2">Existing Admins</h3>
      <ul className="mb-6">
        {admins.map((a) => (
          <li key={a.id} className="border-b py-2">
            <div>
              <span className="font-semibold">{a.full_name}</span> ({a.username}) – {a.email}
            </div>
            <div className="text-sm text-gray-500">
              Created: {a.created_at ? new Date(a.created_at).toLocaleString() : "N/A"} | 
              Last Login: {a.last_login ? new Date(a.last_login).toLocaleString() : "Never"}
            </div>
          </li>
        ))}
      </ul>

      {/* Add new admin */}
      <h3 className="font-semibold mb-2">Add New Admin</h3>
      <form onSubmit={handleAddAdmin}>
        <input
          type="text"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="border p-2 w-full mb-3 rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 w-full mb-3 rounded"
          required
        />
        <input
          type="text"
          placeholder="Full Name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="border p-2 w-full mb-3 rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="border p-2 w-full mb-3 rounded"
          required
        />
        <button
          type="submit"
          disabled={loading} // disable when submitting
          className={`p-2 w-full rounded text-white ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {loading ? "Adding..." : "Add Admin"}
        </button>
      </form>
    </div>
  );
};

export default AdminManagement;
