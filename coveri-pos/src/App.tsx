import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './app/shell.css';
import { cx } from './lib/cx';
import { FloorScreen } from './screens/floor/FloorScreen';
import { KitchenScreen } from './screens/kitchen/KitchenScreen';
import { OrderScreen } from './screens/order/OrderScreen';
import { PaymentScreen } from './screens/pay/PaymentScreen';
import { ReceiptScreen } from './screens/receipt/ReceiptScreen';
import { RegisterScreen } from './screens/register/RegisterScreen';
import { StyleGuide } from './screens/styleguide/StyleGuide';
import { useSessionStore } from './stores/sessionStore';

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

export function App() {
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
          </nav>
          <TopbarSession />
        </header>

        <Routes>
          <Route path="/" element={<FloorScreen />} />
          <Route path="/table/:tableId" element={<OrderScreen />} />
          <Route path="/table/:tableId/pay" element={<PaymentScreen />} />
          <Route path="/bill/:orderId" element={<ReceiptScreen kind="bill" />} />
          <Route path="/receipt/:orderId" element={<ReceiptScreen kind="receipt" />} />
          <Route path="/kitchen" element={<KitchenScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/styleguide" element={<StyleGuide />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
