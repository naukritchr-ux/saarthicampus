import {
  LayoutDashboard,
  GraduationCap,
  Building2,
  Users,
  Briefcase,
  Coins,
  FileText,
  CheckSquare,
  MessageSquare,
  PhoneCall,
  BarChart3,
  Settings,
  UserCheck,
  Award,
  Video,
  GitBranch,
  Search,
  CheckCircle2,
  ClipboardList
} from 'lucide-react';

const NAV = {
  admin: [
    { section: 'Overview', items: [{ key: 'adminDashboard', icon: LayoutDashboard, label: 'Dashboard' }] },
    { section: 'Setup', items: [
      { key: 'campusdb', icon: GraduationCap, label: 'Campus Database' },
      { key: 'corpdb', icon: Building2, label: 'Corporate Database' },
      { key: 'candidatedb', icon: Users, label: 'Candidate Database' },
      { key: 'jobs', icon: Briefcase, label: 'Job Profiles' },
      { key: 'bidportal', icon: Coins, label: 'Bid Portal' },
    ]},
    { section: 'Recruitment', items: [
      { key: 'resume', icon: FileText, label: 'Resume Analyzer (AI)' },
      { key: 'aptitude', icon: CheckSquare, label: 'Aptitude Test' },
      { key: 'gd', icon: MessageSquare, label: 'Group Discussion' },
      { key: 'interview', icon: Video, label: 'Interviews' },
      { key: 'offers', icon: Award, label: 'Offer Letters' },
      { key: 'pipeline', icon: GitBranch, label: 'Candidate Pipeline' },
    ]},
    { section: 'Tracking', items: [
      { key: 'joining', icon: UserCheck, label: 'Joining Tracker' },
      { key: 'comm', icon: MessageSquare, label: 'Communication CRM' },
      { key: 'callrecords', icon: PhoneCall, label: 'Call Records' },
      { key: 'reports', icon: BarChart3, label: 'Reports & Analytics' },
    ]},
    { section: 'System', items: [
      { key: 'usermanagement', icon: Settings, label: 'User Management' },
    ]},
  ],

  corporate: [
    { section: 'Overview', items: [
      { key: 'corporateDashboard', icon: LayoutDashboard, label: 'Company Dashboard' },
      { key: 'companyProfile', icon: Building2, label: 'Company Profile' },
    ]},
    { section: 'Hiring', items: [
      { key: 'jobs', icon: Briefcase, label: 'Job Postings' },
      { key: 'candidateSearch', icon: Search, label: 'Candidate Search' },
      { key: 'resume', icon: FileText, label: 'Applications' },
      { key: 'aptitude', icon: CheckSquare, label: 'Aptitude Test' },
      { key: 'gd', icon: MessageSquare, label: 'Group Discussion' },
      { key: 'interview', icon: Video, label: 'Interviews' },
      { key: 'offers', icon: Award, label: 'Offer Letters' },
      { key: 'joining', icon: UserCheck, label: 'Employee (Joined)' },
      { key: 'approvals', icon: CheckCircle2, label: 'Approvals' },
      { key: 'documents', icon: FileText, label: 'Documents' },
    ]},
    { section: 'Analytics', items: [
      { key: 'hiringAnalytics', icon: BarChart3, label: 'Reports & Analytics' },
    ]},
  ],

  candidate: [
    { section: 'My Journey', items: [
      { key: 'candidateDashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { key: 'jobs', icon: Briefcase, label: 'Job Opportunities' },
      { key: 'myApplications', icon: ClipboardList, label: 'My Applications' },
      { key: 'aptitude', icon: CheckSquare, label: 'Aptitude Test' },
      { key: 'gd', icon: MessageSquare, label: 'Group Discussion' },
      { key: 'interview', icon: Video, label: 'Interviews' },
      { key: 'offers', icon: Award, label: 'Offer Letters' },
      { key: 'joining', icon: UserCheck, label: 'Joining Status' },
    ]},
  ],
};

export default function Sidebar({ activePage, setActivePage, role = 'admin', className = '' }) {
  const nav = NAV[role] || NAV.admin;
  return (
    <aside className={`sidebar ${className}`} role="navigation" aria-label="Sidebar navigation">
      {nav.map((group) => (
        <div key={group.section}>
          <div className="side-section-label">{group.section}</div>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                aria-current={activePage === item.key ? 'page' : undefined}
                className={`side-link ${activePage === item.key ? 'active' : ''}`}
                onClick={() => setActivePage(item.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActivePage(item.key);
                  }
                }}
              >
                <span className="side-icon" aria-hidden="true">
                  {typeof Icon === 'string' ? Icon : (Icon ? <Icon size={16} /> : null)}
                </span>
                <span className="side-text">{item.label}</span>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}