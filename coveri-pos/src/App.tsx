import { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import './app/shell.css';
import { cx } from './lib/cx';
import { FloorScreen } from './screens/floor/FloorScreen';
import { KitchenScreen } from './screens/kitchen/KitchenScreen';
import { OrderScreen } from './screens/order/OrderScreen';
import { PaymentScreen } from './screens/pay/PaymentScreen';
import { ReceiptScreen } from './screens/receipt/ReceiptScreen';
import { RegisterScreen } from './screens/register/RegisterScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { LoginScreen } from './screens/auth/LoginScreen';
import { StaffLockScreen } from './screens/auth/StaffLockScreen';
import { StyleGuide } from './screens/styleguide/StyleGuide';
import { initSync, useSyncStore } from './lib/syncQueue';
import { useAuthStore } from './stores/authStore';
import { useSessionStore } from './stores/sessionStore';

initSync();

function SyncBadge() {
  const online = useSyncStore((s) => s.online);
  const pending = useSyncStore((s) => s.pending);
  if (online && pending === 0) return null;
  return (
    <span className={cx('sync-badge', !online && 'sync-badge--offline')} role="status">
      {online ? `Syncing ${pending}…` : `Offline${pending > 0 ? ` · ${pending} pending` : ''}`}
    </span>
  );
}

function TopbarSession() {
  const session = useSessionStore((s) => s.session);
  const init = useSessionStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  return (
    <Link to="/register" className="topbar__session" aria-label="Register status">
      <span className={cx('dot', !session && 'dot--off')} /> {session ? 'Register open' : 'Register closed'}
    </Link>
  );
}

/** Current staff chip → lock (switch user) / sign out menu. */
function UserChip() {
  const { staff, lock, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  if (!staff) return null;
  return (
    <div className="userchip">
      <button className="userchip__btn" onClick={() => setOpen((o) => !o)}>
        <span className="userchip__avatar">{staff.name.charAt(0).toUpperCase()}</span>
        <span className="userchip__name">{staff.name}</span>
      </button>
      {open && (
        <>
          <div className="userchip__scrim" onClick={() => setOpen(false)} />
          <div className="userchip__menu">
            <div className="userchip__role">{staff.role}</div>
            <button className="userchip__item" onClick={() => { setOpen(false); lock(); }}>
              Switch user
            </button>
            <button className="userchip__item" onClick={() => { setOpen(false); void signOut(); }}>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const isManager = (role?: string) => role === 'manager' || role === 'admin';

export function App() {
  const { ready, session, staff, init } = useAuthStore();

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) return null; // brief; avoids a login flash before session restores

  // Auth gate: no session → login; signed in but no staff identity → lock screen.
  if (!session) return <LoginScreen />;
  if (!staff) return <StaffLockScreen />;

  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <Link to="/" className="brand">
            <span className="brand__mark">
              COV<em>E</em>RI
            </span>
            <span className="brand__tag">Service, Simplified.</span>
          </Link>
          <nav className="topbar__nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link nav-link--on' : 'nav-link')}>
              Floor
            </NavLink>
            <NavLink to="/kitchen" className={({ isActive }) => (isActive ? 'nav-link nav-link--on' : 'nav-link')}>
              Kitchen
            </NavLink>
            {isManager(staff.role) && (
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link nav-link--on' : 'nav-link')}>
                Settings
              </NavLink>
            )}
          </nav>
          <SyncBadge />
          <TopbarSession />
          <UserChip />
        </header>

        <Routes>
          <Route path="/" element={<FloorScreen />} />
          <Route path="/table/:tableId" element={<OrderScreen />} />
          <Route path="/table/:tableId/pay" element={<PaymentScreen />} />
          <Route path="/bill/:orderId" element={<ReceiptScreen kind="bill" />} />
          <Route path="/receipt/:orderId" element={<ReceiptScreen kind="receipt" />} />
          <Route path="/kitchen" element={<KitchenScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route
            path="/settings/*"
            element={isManager(staff.role) ? <SettingsScreen /> : <Navigate to="/" replace />}
          />
          <Route path="/styleguide" element={<StyleGuide />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
