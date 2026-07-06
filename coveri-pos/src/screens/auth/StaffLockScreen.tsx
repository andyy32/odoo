import { useEffect, useState } from 'react';
import './auth.css';
import { Button, Numpad } from '@/components/primitives';
import { cx } from '@/lib/cx';
import { useAuthStore } from '@/stores/authStore';
import type { StaffPublic } from '@/data/authRepo';

const PIN_LENGTH = 4;

/**
 * "Who's on shift" — after the owner is signed in, each staff member taps their
 * name and enters a 4-digit PIN to become the current identity on the terminal.
 */
export function StaffLockScreen() {
  const { staffList, refreshStaffList, identifyStaff, signOut } = useAuthStore();
  const [selected, setSelected] = useState<StaffPublic | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (staffList.length === 0) void refreshStaffList();
  }, [staffList.length, refreshStaffList]);

  // Auto-submit once the PIN is complete.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    void identifyStaff(pin).then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 600);
      }
      // on success the guard swaps this screen out
    });
    return () => {
      cancelled = true;
    };
  }, [pin, identifyStaff]);

  if (!selected) {
    return (
      <div className="auth">
        <div className="auth__brand">
          <div className="auth__mark">
            COV<em>E</em>RI
          </div>
          <div className="auth__tag">Who's on shift?</div>
        </div>
        <div className="auth__card">
          <div className="stafflock__grid">
            {staffList.map((s) => (
              <button key={s.id} className="staff-chip" onClick={() => setSelected(s)}>
                <span className="staff-chip__avatar">{s.name.charAt(0).toUpperCase()}</span>
                <span className="staff-chip__name">{s.name}</span>
                <span className="staff-chip__role">{s.role}</span>
              </button>
            ))}
            {staffList.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)' }}>No staff found for this account.</div>
            )}
          </div>
        </div>
        <button className="auth__link" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth__brand">
        <div className="auth__mark">{selected.name}</div>
        <div className="auth__tag">Enter your PIN</div>
      </div>
      <div className="auth__card">
        <div className="pin__dots">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cx('pin__dot', i < pin.length && 'pin__dot--on', error && 'pin__dot--err')}
            />
          ))}
        </div>
        <Numpad
          onKey={(k) =>
            setPin((prev) => {
              if (k === 'back') return prev.slice(0, -1);
              if (k === '.') return prev;
              return prev.length < PIN_LENGTH ? prev + k : prev;
            })
          }
        />
        <Button variant="ghost" onClick={() => { setSelected(null); setPin(''); }}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
