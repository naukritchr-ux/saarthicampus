import { useEffect, useState } from "react";
import { getCorporateKpis as getHiringAnalytics } from "../lib/api";
import "./CorporateDashboard.css";

const METRIC_CARDS = [
  { key: "jobsPosted", label: "Jobs Posted", icon: "💼" },
  { key: "activeJobs", label: "Active Jobs", icon: "📌" },
  { key: "applications", label: "Applications", icon: "📥" },
  { key: "shortlisted", label: "Shortlisted", icon: "📋" },
  { key: "interviews", label: "Interviews", icon: "🗣️" },
  { key: "offers", label: "Offers", icon: "📨" },
  { key: "joined", label: "Joined", icon: "✅" },
];

export default function HiringAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getHiringAnalytics()
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to load hiring analytics");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="corporate-app">
        <main className="corporate-main" style={{ marginLeft: 0, width: "100%" }}>
          <section className="corporate-content">
            <p>Loading hiring analytics…</p>
          </section>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="corporate-app">
        <main className="corporate-main" style={{ marginLeft: 0, width: "100%" }}>
          <section className="corporate-content">
            <p style={{ color: "crimson" }}>{error}</p>
          </section>
        </main>
      </div>
    );
  }

  const matchRate = data?.matchRate ?? 0;
  const hiringConversion = data?.hiringConversion ?? 0;

  return (
    <div className="corporate-app">
      <main className="corporate-main" style={{ marginLeft: 0, width: "100%" }}>
        <header className="corporate-topbar">
          <div>
            <h1>Hiring Analytics</h1>
            <p>Actual hiring activity across your job postings</p>
          </div>
        </header>

        <section className="corporate-content">
          <div className="corporate-stats">
            {METRIC_CARDS.map((card) => (
              <div className="corporate-stat-card" key={card.key}>
                <div className="corporate-stat-icon">{card.icon}</div>
                <h3>{data?.[card.key] ?? 0}</h3>
                <p>{card.label}</p>
              </div>
            ))}
          </div>

          <div className="corporate-two-column">
            <div className="corporate-card">
              <div className="corporate-card-header">
                <div>
                  <h3>Candidate Match Rate</h3>
                  <p>Average AI match score across your applicants</p>
                </div>
              </div>
              <div className="profile-verification-dot" style={{ fontSize: 22, width: 60, height: 60 }}>
                {matchRate}%
              </div>
            </div>

            <div className="corporate-card">
              <div className="corporate-card-header">
                <div>
                  <h3>Hiring Conversion</h3>
                  <p>Applications that resulted in a joining</p>
                </div>
              </div>
              <div className="profile-verification-dot" style={{ fontSize: 22, width: 60, height: 60 }}>
                {hiringConversion}%
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}