import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/hoy', label: 'Hoy' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/estudio', label: 'Estudio' },
  { to: '/foco', label: 'Foco' },
  { to: '/mas', label: 'Más' },
];

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 border-t border-border bg-surface/90 backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                `block py-3 text-center text-xs font-medium ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
