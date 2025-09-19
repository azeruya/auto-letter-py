// src/pages/Stats.tsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { DashboardStats } from "../types";

const Stats = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch("http://localhost:8000/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    };
    fetchStats();
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard Overview</h1>

      {stats ? (
        <div>
          <p>Total Requests: {stats.total_requests}</p>
          <p>Pending: {stats.pending_requests}</p>

          <h2 className="font-bold mt-4">Recent Requests</h2>
          <ul>
            {stats.recent_requests.map((r) => (
              <li key={r.id}>
                {r.student_name} - {r.template_name} ({r.status})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>Loading stats...</p>
      )}
    </div>
  );
};

export default Stats;
