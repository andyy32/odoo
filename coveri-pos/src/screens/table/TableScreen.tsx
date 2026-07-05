import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '@/components/primitives';
import { useFloorStore } from '@/stores/floorStore';

/**
 * Phase-3 placeholder: the order screen for a table. For now it proves the
 * floor → table navigation and shows the table context; the product grid and
 * order editing land next phase.
 */
export function TableScreen() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const table = useFloorStore((s) => s.tables.find((t) => t.id === tableId));
  const order = useFloorStore((s) => (tableId ? s.draftOrdersByTable.get(tableId) : undefined));

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: 560, width: '100%', margin: '0 auto' }}>
      <Card>
        <h2 style={{ marginBottom: 'var(--space-3)' }}>
          Table {table?.table_number ?? '—'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
          {order
            ? `Open order — running total will resume here.`
            : `No open order. The order screen (products, lines, fire-to-kitchen) arrives in Phase 3.`}
        </p>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Back to floor
        </Button>
      </Card>
    </div>
  );
}
