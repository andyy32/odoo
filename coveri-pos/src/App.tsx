import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import './app/shell.css';
import { FloorScreen } from './screens/floor/FloorScreen';
import { OrderScreen } from './screens/order/OrderScreen';
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
          <div className="topbar__session">
            <span className="dot" /> Register open
          </div>
        </header>

        <Routes>
          <Route path="/" element={<FloorScreen />} />
          <Route path="/table/:tableId" element={<OrderScreen />} />
          <Route path="/styleguide" element={<StyleGuide />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
