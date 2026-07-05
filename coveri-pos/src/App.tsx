import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './app/shell.css';
import { FloorScreen } from './screens/floor/FloorScreen';
import { KitchenScreen } from './screens/kitchen/KitchenScreen';
import { OrderScreen } from './screens/order/OrderScreen';
import { PaymentScreen } from './screens/pay/PaymentScreen';
import { ReceiptScreen } from './screens/receipt/ReceiptScreen';
import { StyleGuide } from './screens/styleguide/StyleGuide';

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
          <div className="topbar__session">
            <span className="dot" /> Register open
          </div>
        </header>

        <Routes>
          <Route path="/" element={<FloorScreen />} />
          <Route path="/table/:tableId" element={<OrderScreen />} />
          <Route path="/table/:tableId/pay" element={<PaymentScreen />} />
          <Route path="/bill/:orderId" element={<ReceiptScreen kind="bill" />} />
          <Route path="/receipt/:orderId" element={<ReceiptScreen kind="receipt" />} />
          <Route path="/kitchen" element={<KitchenScreen />} />
          <Route path="/styleguide" element={<StyleGuide />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
