import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const STATUS_STYLES = {
  "Pending Verification": { bg: "#FFF3E0", color: "#A15C00" },
  Verified: { bg: "#E3F2FD", color: "#1565C0" },
  Active: { bg: "#E8F7EE", color: "#16803A" },
};

const emptyForm = {
  name: "",
  logo_url: "",
  industry: "",
  company_size: "",
  city: "",
  website: "",
  about: "",
  contact_name: "",
  contact_designation: "",
  hr_phone: "",
  hr_email: "",
  fresher_hiring_requirements: "",
  hiring_volume: "",
};

export default function CompanyProfile({ user }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(
    "Pending Verification"
  );
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (ignore) return;

      if (profileError || !profile?.company_id) {
        console.error("Could not find linked company:", profileError);
        setError(
          "No company is linked to your account yet. Please contact admin."
        );
        setLoading(false);
        return;
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .single();

      if (ignore) return;

      if (companyError || !company) {
        console.error("Could not load company:", companyError);
        setError("Could not load company profile.");
        setLoading(false);
        return;
      }

      setCompanyId(company.id);
      setVerificationStatus(company.verification_status || "Pending Verification");
      setForm({
        name: company.name || "",
        logo_url: company.logo_url || "",
        industry: company.industry || "",
        company_size: company.company_size || "",
        city: company.city || "",
        website: company.website || "",
        about: company.about || "",
        contact_name: company.contact_name || company.hr_name || "",
        contact_designation: company.contact_designation || "",
        hr_phone: company.hr_phone || "",
        hr_email: company.hr_email || "",
        fresher_hiring_requirements: company.fresher_hiring_requirements || "",
        hiring_volume: company.hiring_volume || "",
      });
      setLogoPreview(company.logo_url || "");
      setLoading(false);
    }

    load();

    return () => {
      ignore = true;
    };
  }, [user.id]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleLogoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!companyId) return;

    if (!form.name.trim()) {
      alert("Company name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    let logoUrl = form.logo_url;

    // Upload logo to Supabase storage if a new file was picked
    if (logoFile) {
      const fileExt = logoFile.name.split(".").pop();
      const filePath = `company-logos/${companyId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) {
        console.error("Logo upload failed:", uploadError);
        alert(
          "Could not upload logo. Make sure a 'company-assets' storage bucket exists. Other changes will still be saved."
        );
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("company-assets")
          .getPublicUrl(filePath);
        logoUrl = publicUrlData?.publicUrl || logoUrl;
      }
    }

    const updatePayload = {
      name: form.name.trim(),
      logo_url: logoUrl || null,
      industry: form.industry || null,
      company_size: form.company_size || null,
      city: form.city || null,
      website: form.website || null,
      about: form.about || null,
      contact_name: form.contact_name || null,
      contact_designation: form.contact_designation || null,
      hr_phone: form.hr_phone || null,
      hr_email: form.hr_email || null,
      fresher_hiring_requirements: form.fresher_hiring_requirements || null,
      hiring_volume: form.hiring_volume || null,
      // Also keep legacy hr_name in sync so Corporate Database (CorpDB) view stays consistent
      hr_name: form.contact_name || null,
    };

    const { error: updateError } = await supabase
      .from("companies")
      .update(updatePayload)
      .eq("id", companyId);

    setSaving(false);

    if (updateError) {
      console.error("Failed to save company profile:", updateError);
      setError("Could not save changes. Please try again.");
      return;
    }

    setForm((prev) => ({ ...prev, logo_url: logoUrl }));
    setLogoFile(null);
    alert("Company profile saved.");
  }

  if (loading) {
    return (
      <div className="page active">
        <div className="panel" style={{ padding: 30, textAlign: "center" }}>
          Loading company profile…
        </div>
      </div>
    );
  }

  if (error && !companyId) {
    return (
      <div className="page active">
        <div className="panel" style={{ padding: 30, color: "crimson" }}>
          {error}
        </div>
      </div>
    );
  }

  const statusStyle =
    STATUS_STYLES[verificationStatus] || STATUS_STYLES["Pending Verification"];

  return (
    <div className="page active" id="page-company-profile">
      <div className="page-head">
        <div>
          <h1>Company Profile</h1>
          <p>Manage your company details shown to Saarthi Campus admins and candidates</p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: statusStyle.bg,
            color: statusStyle.color,
            whiteSpace: "nowrap",
          }}
        >
          {verificationStatus}
        </span>
      </div>

      {error && (
        <div className="panel" style={{ color: "crimson", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* BASIC DETAILS */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-title">Basic Details</div>
          <div className="panel-sub">Core information about your company</div>

          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              margin: "16px 0",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                border: "1px solid var(--border-default, #eee)",
                background: "var(--bg-soft, #fafafc)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company logo"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 24 }}>🏢</span>
              )}
            </div>

            <div>
              <input type="file" accept="image/*" onChange={handleLogoSelect} />
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                PNG or JPG, square image recommended
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <input
              className="search-box"
              placeholder="Company Name *"
              required
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />

            <input
              className="search-box"
              placeholder="Industry"
              value={form.industry}
              onChange={(e) => handleChange("industry", e.target.value)}
            />

            <select
              className="search-box"
              value={form.company_size}
              onChange={(e) => handleChange("company_size", e.target.value)}
            >
              <option value="">Company Size</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="501-1000">501-1000 employees</option>
              <option value="1000+">1000+ employees</option>
            </select>

            <input
              className="search-box"
              placeholder="Location / City"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
            />

            <input
              className="search-box"
              placeholder="Website (https://...)"
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
              style={{ gridColumn: "span 2" }}
            />

            <textarea
              className="search-box"
              placeholder="About Company"
              rows={4}
              value={form.about}
              onChange={(e) => handleChange("about", e.target.value)}
              style={{ gridColumn: "span 2", resize: "vertical" }}
            />
          </div>
        </div>

        {/* RECRUITER / CONTACT DETAILS */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-title">Recruiter / Contact Details</div>
          <div className="panel-sub">Primary point of contact for hiring</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <input
              className="search-box"
              placeholder="Contact Name"
              value={form.contact_name}
              onChange={(e) => handleChange("contact_name", e.target.value)}
            />

            <input
              className="search-box"
              placeholder="Designation (e.g. HR Manager)"
              value={form.contact_designation}
              onChange={(e) =>
                handleChange("contact_designation", e.target.value)
              }
            />

            <input
              className="search-box"
              placeholder="Contact Phone"
              value={form.hr_phone}
              onChange={(e) => handleChange("hr_phone", e.target.value)}
              inputMode="numeric"
              maxLength={10}
            />

            <input
              className="search-box"
              placeholder="Contact Email"
              type="email"
              value={form.hr_email}
              onChange={(e) => handleChange("hr_email", e.target.value)}
            />
          </div>
        </div>

        {/* FRESHER HIRING */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-title">Fresher Hiring Requirements</div>
          <div className="panel-sub">
            Tell candidates and admins what roles you're hiring freshers for
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <textarea
              className="search-box"
              placeholder="Fresher Hiring Requirements (roles, skills, eligibility)"
              rows={3}
              value={form.fresher_hiring_requirements}
              onChange={(e) =>
                handleChange("fresher_hiring_requirements", e.target.value)
              }
              style={{ gridColumn: "span 2", resize: "vertical" }}
            />

            <select
              className="search-box"
              value={form.hiring_volume}
              onChange={(e) => handleChange("hiring_volume", e.target.value)}
            >
              <option value="">Hiring Volume</option>
              <option value="1-5">1-5 freshers</option>
              <option value="6-20">6-20 freshers</option>
              <option value="21-50">21-50 freshers</option>
              <option value="50+">50+ freshers</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-gold" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Company Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}