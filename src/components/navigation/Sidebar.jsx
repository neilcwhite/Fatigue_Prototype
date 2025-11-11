import { FiCalendar, FiUsers, FiLayout, FiGrid, FiBarChart2, FiSettings } from 'react-icons/fi';

const links = [
  { id: 'dashboard', label: 'Dashboard', icon: FiLayout },
  { id: 'planning', label: 'Project Planning', icon: FiCalendar },
  { id: 'people', label: 'Person View', icon: FiUsers },
  { id: 'patterns', label: 'Shift Pattern Manager', icon: FiGrid },
  { id: 'teams', label: 'Team Manager', icon: FiUsers },
  { id: 'summary', label: 'Project Summary', icon: FiBarChart2 },
  { id: 'settings', label: 'Configuration', icon: FiSettings, disabled: true }
];

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div>
        <h1>Network Rail<br />Fatigue Planning</h1>
        <p className="small" style={{ marginTop: '8px' }}>Prototype preview</p>
      </div>

      <nav className="nav-section">
        {links.map((link) => {
          const Icon = link.icon;
          const className = [
            'nav-link',
            activePage === link.id ? 'active' : '',
            link.disabled ? 'disabled' : ''
          ].join(' ').trim();

          return (
            <button
              key={link.id}
              className={className}
              disabled={link.disabled}
              onClick={() => onNavigate(link.id)}
              style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0 }}
            >
              <span className="flex" style={{ justifyContent: 'flex-start' }}>
                <Icon size={18} />
                <span>{link.label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#94a3b8' }}>
        Data refreshed hourly · v0.1 prototype
      </div>
    </aside>
  );
}

export default Sidebar;
