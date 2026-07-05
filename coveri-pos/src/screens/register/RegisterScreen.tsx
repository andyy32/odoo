import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './register.css';
import { Button, Numpad, SlidePanel } from '@/components/primitives';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/money';
import { useSessionStore, type SessionReport } from '@/stores/sessionStore';
import type { PosSession } from '@/types/db';

/**
 * The register: open with a cash float, watch the live X-report while
 * trading, move cash in/out, and close with a counted-cash check that
 * produces the session's Z-report (expected vs counted difference).
 */
function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function RegisterScreen() {
  const navigate = useNavigate();
  const { loading, session, init, open, close, cashMove, buildReport } = useSessionStore();

  const [report, setReport] = useState<SessionReport | null>(null);
  const [entry, setEntry] = useState('');
  const [moveOpen, setMoveOpen] = useState<'in' | 'out' | null>(null);
  const [moveReason, setMoveReason] = useState('');
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<{ session: PosSession; counted: number; report: SessionReport } | null>(null);

  const refreshReport = useCallback(() => {
    const s = useSessionStore.getState().session;
    if (s) void buildReport(s).then(setReport);
  }, [buildReport]);

  useEffect(() => {
    void init().then(refreshReport);
  }, [init, refreshReport]);

  const entryAmount = (() => {
    const n = parseFloat(entry);
    return Number.isFinite(n) ? +n.toFixed(2) : 0;
  })();

  const numpadKey = (k: string) =>
    setEntry((prev) => {
      if (k === 'back') return prev.slice(0, -1);
      if (k === '.') return prev.includes('.') ? prev : (prev || '0') + '.';
      return prev + k;
    });

  if (loading) return <div className="pay-status">Loading register…</div>;

  /* ---------- Z-report after close ---------- */
  if (closed) {
    const diff = +(closed.counted - closed.report.expectedCash).toFixed(2);
    return (
      <div className="reg">
        <div className="reg__panel">
          <div className="reg__title">Register closed — Z report</div>
          <div className="reg__sub">
            Opened {fmtWhen(closed.session.opened_at)} · {closed.report.ordersCount} orders ·{' '}
            {closed.report.guests} guests
          </div>
          <ReportRows report={closed.report} openingCash={Number(closed.session.opening_cash)} />
          <div className="reg__rows">
            <div className="rrow">
              <span>Counted cash</span>
              <b className="numeric">{formatMoney(closed.counted)}</b>
            </div>
            <div className={cx('rrow', Math.abs(diff) < 0.005 ? 'rrow--good' : 'rrow--bad')}>
              <span>Difference</span>
              <b className="numeric">{diff >= 0 ? '+' : ''}{formatMoney(diff)}</b>
            </div>
          </div>
        </div>
        <div className="reg__actions">
          <Button variant="ghost" onClick={() => window.print()}>
            Print Z report
          </Button>
          <Button variant="primary" onClick={() => navigate('/')}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- closed register: open it ---------- */
  if (!session) {
    return (
      <div className="reg">
        <div className="reg__panel">
          <div className="reg__title">Open the register</div>
          <div className="reg__sub">Count the cash float in the drawer to start the day.</div>
          <div className="reg__amount numeric">{entry ? formatMoney(entryAmount) : formatMoney(0)}</div>
          <Numpad
            onKey={numpadKey}
            actionLabel="Open Register"
            onAction={() => {
              void open(entryAmount).then(() => {
                setEntry('');
                refreshReport();
              });
            }}
          />
        </div>
      </div>
    );
  }

  /* ---------- open register: live X report + actions ---------- */
  return (
    <div className="reg">
      <div className="reg__stats">
        <div className="stat">
          <div className="stat__label">Gross sales</div>
          <div className="stat__value numeric">{formatMoney(report?.gross ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Orders</div>
          <div className="stat__value numeric">{report?.ordersCount ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Guests</div>
          <div className="stat__value numeric">{report?.guests ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Expected cash</div>
          <div className="stat__value numeric">{formatMoney(report?.expectedCash ?? Number(session.opening_cash))}</div>
        </div>
      </div>

      <div className="reg__panel">
        <div className="reg__title">Session</div>
        <div className="reg__sub">Opened {fmtWhen(session.opened_at)}</div>
        {report && <ReportRows report={report} openingCash={Number(session.opening_cash)} />}
      </div>

      <div className="reg__actions">
        <Button variant="ghost" onClick={() => { setEntry(''); setMoveReason(''); setMoveOpen('in'); }}>
          Cash In
        </Button>
        <Button variant="ghost" onClick={() => { setEntry(''); setMoveReason(''); setMoveOpen('out'); }}>
          Cash Out
        </Button>
        <Button variant="ghost" onClick={refreshReport}>
          Refresh
        </Button>
        <Button variant="primary" onClick={() => { setEntry(''); setClosing(true); }}>
          Close Register
        </Button>
      </div>

      {/* cash in/out */}
      <SlidePanel
        open={moveOpen !== null}
        onClose={() => setMoveOpen(null)}
        side="right"
        title={moveOpen === 'in' ? 'Cash In' : 'Cash Out'}
      >
        <div className="reg__amount numeric">{entry ? formatMoney(entryAmount) : formatMoney(0)}</div>
        <input
          className="line-editor__input"
          style={{ marginBottom: 'var(--space-4)' }}
          placeholder={moveOpen === 'in' ? 'Reason (e.g. change from bank)' : 'Reason (e.g. supplier paid cash)'}
          value={moveReason}
          onChange={(e) => setMoveReason(e.target.value)}
        />
        <Numpad
          onKey={numpadKey}
          actionLabel={moveOpen === 'in' ? 'Add Cash In' : 'Add Cash Out'}
          onAction={() => {
            const signed = moveOpen === 'in' ? entryAmount : -entryAmount;
            void cashMove(signed, moveReason).then(() => {
              setMoveOpen(null);
              refreshReport();
            });
          }}
        />
      </SlidePanel>

      {/* close: counted cash */}
      <SlidePanel open={closing} onClose={() => setClosing(false)} side="right" title="Close Register">
        <div className="reg__sub">Count the drawer and enter the amount.</div>
        <div className="reg__amount numeric">{entry ? formatMoney(entryAmount) : formatMoney(0)}</div>
        {report && (
          <div className="reg__rows" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="rrow">
              <span>Expected cash</span>
              <b className="numeric">{formatMoney(report.expectedCash)}</b>
            </div>
            {entry && (
              <div
                className={cx(
                  'rrow',
                  Math.abs(entryAmount - report.expectedCash) < 0.005 ? 'rrow--good' : 'rrow--bad',
                )}
              >
                <span>Difference</span>
                <b className="numeric">
                  {entryAmount - report.expectedCash >= 0 ? '+' : ''}
                  {formatMoney(+(entryAmount - report.expectedCash).toFixed(2))}
                </b>
              </div>
            )}
          </div>
        )}
        <Numpad
          onKey={numpadKey}
          actionLabel="Confirm Close"
          onAction={() => {
            if (!report) return;
            const snapshot = { session, counted: entryAmount, report };
            void close(entryAmount).then(() => {
              setClosing(false);
              setClosed(snapshot);
            });
          }}
        />
      </SlidePanel>
    </div>
  );
}

function ReportRows({ report, openingCash }: { report: SessionReport; openingCash: number }) {
  return (
    <div className="reg__rows">
      <div className="rrow">
        <span>Net sales (excl. tax)</span>
        <span className="numeric">{formatMoney(report.net)}</span>
      </div>
      <div className="rrow">
        <span>Taxes</span>
        <span className="numeric">{formatMoney(report.taxTotal)}</span>
      </div>
      <div className="rrow">
        <span>Gross sales</span>
        <b className="numeric">{formatMoney(report.gross)}</b>
      </div>
      {report.byMethod.map((m) => (
        <div className="rrow" key={m.name}>
          <span>{m.name}</span>
          <span className="numeric">{formatMoney(m.amount)}</span>
        </div>
      ))}
      <div className="rrow">
        <span>Opening float</span>
        <span className="numeric">{formatMoney(openingCash)}</span>
      </div>
      {report.cashIn > 0 && (
        <div className="rrow">
          <span>Cash in</span>
          <span className="numeric">{formatMoney(report.cashIn)}</span>
        </div>
      )}
      {report.cashOut < 0 && (
        <div className="rrow">
          <span>Cash out</span>
          <span className="numeric">{formatMoney(report.cashOut)}</span>
        </div>
      )}
      <div className="rrow">
        <span>Expected cash in drawer</span>
        <b className="numeric">{formatMoney(report.expectedCash)}</b>
      </div>
    </div>
  );
}
