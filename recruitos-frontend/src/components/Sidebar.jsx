const NAV = {
  admin: [
    { section: 'Overview', items: [{ key: 'adminDashboard', icon: '◆', label: 'Dashboard' }] },
    { section: 'Setup', items: [
      { key: 'campusdb', icon: '▤', label: 'Campus Database' },
      { key: 'corpdb', icon: '▤', label: 'Corporate Database' },
      { key: 'candidatedb', icon: '▤', label: 'Candidate Database' },
      { key: 'jobs', icon: '▤', label: 'Job Profiles' },
      { key: 'bidportal', icon: '💰', label: 'Bid Portal' },
    ]},
    { section: 'Recruitment', items: [
      { key: 'resume', icon: '→', label: 'Resume Analyzer (AI)' },
      { key: 'aptitude', icon: '→', label: 'Aptitude Test' },
      { key: 'gd', icon: '→', label: 'Group Discussion' },
      { key: 'interview', icon: '→', label: 'Interviews' },
      { key: 'offers', icon: '→', label: 'Offer Letters' },
      { key : 'pipeline', icon: '→', label: 'Candidate Pipeline' },
    ]},
    { section: 'Tracking', items: [
      { key: 'joining', icon: '●', label: 'Joining Tracker' },
      { key: 'comm', icon: '●', label: 'Communication CRM' },
      { key: 'callrecords', icon: '●', label: 'Call Records' },
      { key: 'reports', icon: '●', label: 'Reports & Analytics' },
    ]},
    { section: 'System', items: [
      { key: 'usermanagement', icon: '⚙', label: 'User Management' },
    ]},
  ],

  recruiter: [
    { section: 'Overview', items: [{ key: 'recruiterDashboard', icon: '◆', label: 'Dashboard' }] },
    { section: 'Database', items: [
      { key: 'campusdb', icon: '▤', label: 'Campus Database' },
      { key: 'corpdb', icon: '▤', label: 'Corporate Database' },
      { key: 'candidatedb', icon: '▤', label: 'Candidate Database' },
    ]},
    { section: 'Recruitment', items: [
      { key: 'resume', icon: '→', label: 'Resume Analyzer (AI)' },
      { key: 'aptitude', icon: '→', label: 'Aptitude Test' },
      { key: 'gd', icon: '→', label: 'Group Discussion' },
      { key: 'interview', icon: '→', label: 'Interviews' },
      { key: 'offers', icon: '→', label: 'Offer Letters' },
      { key: 'pipeline', icon: '→', label: 'Candidate Pipeline' },
      { key: 'comm', icon: '●', label: 'Communication CRM' },
      { key: 'reports', icon: '●', label: 'Reports & Analytics' },
    ]},
  ],

corporate: [
  { section: 'Overview', items: [
    { key: 'corporateDashboard', icon: '◆', label: 'Company Dashboard' },
    { key: 'companyProfile', icon: '🏢', label: 'Company Profile' },
  ]},
  { section: 'Hiring', items: [
    { key: 'jobs', icon: '▤', label: 'Job Postings' },
    { key: 'candidateSearch', icon: '🔍', label: 'Candidate Search' },
    { key: 'resume', icon: '→', label: 'Applications' },
    { key: 'interview', icon: '→', label: 'Interviews' },
    { key: 'offers', icon: '●', label: 'Offer Letters' },
    { key: 'joining', icon: '●', label: 'Employee (Joined)' },
    { key: 'approvals', icon: '✓', label: 'Approvals' },
    { key: 'documents', icon: '📄', label: 'Documents' },
  ]},
  { section: 'Analytics', items: [                                  // ⭐ NEW
    { key: 'hiringAnalytics', icon: '📊', label: 'Hiring Analytics' }, // ⭐ NEW
  ]},                                                                  // ⭐ NEW
],

  candidate: [
    { section: 'My Journey', items: [
      { key: 'candidateDashboard', icon: '◆', label: 'Dashboard' },
      { key: 'jobs', icon: '▤', label: 'Job Opportunities' },
      { key: 'myApplications', icon: '→', label: 'My Applications' },
      { key: 'aptitude', icon: '→', label: 'Aptitude Test' },
      { key: 'gd', icon: '→', label: 'Group Discussion' },
      { key: 'interview', icon: '→', label: 'Interviews' },
      { key: 'offers', icon: '●', label: 'Offer Letters' },
      { key: 'joining', icon: '●', label: 'Joining Status' },
    ]},
  ],
};

export default function Sidebar({ activePage, setActivePage, role = 'admin', className = '' }) {
  const nav = NAV[role] || NAV.admin;
  return (
    <div className={`sidebar ${className}`}>
      {nav.map((group) => (
        <div key={group.section}>
          <div className="side-section-label">{group.section}</div>
          {group.items.map((item) => (
            <div
              key={item.key}
              className={`side-link ${activePage === item.key ? 'active' : ''}`}
              onClick={() => setActivePage(item.key)}
            >
              <span className="side-icon">{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}