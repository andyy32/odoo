import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './floor.css';
import { Button, SlidePanel, TableTile } from '@/components/primitives';
import { cx } from '@/lib/cx';
import { useFloorStore } from '@/stores/floorStore';
import type { RestaurantTable, UUID } from '@/types/db';

/**
 * The COVERI floor plan — the app's centerpiece. Tables render at their real
 * positions; occupied tables glow with their running total. Edit mode turns
 * the canvas into a drag-to-arrange editor with a slide-in attribute panel.
 */
export function FloorScreen() {
  const navigate = useNavigate();
  const {
    loading,
    error,
    floors,
    tables,
    draftOrdersByTable,
    activeFloorId,
    editMode,
    load,
    startLive,
    setActiveFloor,
    toggleEditMode,
    moveTableLocal,
    commitTablePosition,
    updateTableAttrs,
    addTable,
    removeTable,
  } = useFloorStore();

  const [editingTableId, setEditingTableId] = useState<UUID | null>(null);

  useEffect(() => {
    void load();
    return startLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floorTables = useMemo(
    () => tables.filter((t) => t.floor_id === activeFloorId),
    [tables, activeFloorId],
  );

  // Canvas grows to fit the furthest table (+ breathing room).
  const canvasSize = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const t of floorTables) {
      w = Math.max(w, t.position_x + t.width);
      h = Math.max(h, t.position_y + t.height);
    }
    return { width: w + 80, height: h + 80 };
  }, [floorTables]);

  const onTableTap = useCallback(
    (table: RestaurantTable) => {
      if (editMode) {
        setEditingTableId(table.id);
      } else {
        navigate(`/table/${table.id}`);
      }
    },
    [editMode, navigate],
  );

  const editingTable = floorTables.find((t) => t.id === editingTableId) ?? null;

  if (loading) return <div className="floor-status">Loading floor…</div>;
  if (error)
    return (
      <div className="floor-status floor-status--error">
        Couldn't load the floor: {error}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button onClick={() => void load()}>Retry</Button>
        </div>
      </div>
    );

  return (
    <div className="floor-screen">
      <div className="floor-toolbar">
        <div className="floor-tabs" role="tablist" aria-label="Floors">
          {floors.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={f.id === activeFloorId}
              className={cx('floor-tab', f.id === activeFloorId && 'floor-tab--active')}
              onClick={() => setActiveFloor(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
        {editMode && (
          <Button variant="ghost" onClick={() => void addTable()}>
            + Table
          </Button>
        )}
        <Button variant={editMode ? 'primary' : 'ghost'} onClick={toggleEditMode}>
          {editMode ? 'Done' : 'Edit'}
        </Button>
      </div>

      <div className="floor-canvas-wrap">
        <div className="floor-canvas" style={canvasSize}>
          {floorTables.length === 0 && (
            <div className="floor-empty">
              No tables on this floor yet.{editMode ? ' Tap “+ Table” to add one.' : ''}
            </div>
          )}
          {floorTables.map((t) => (
            <DraggableTable
              key={t.id}
              table={t}
              editMode={editMode}
              orderTotal={draftOrdersByTable.get(t.id)?.amount_total}
              onTap={onTableTap}
              onMove={moveTableLocal}
              onDrop={commitTablePosition}
            />
          ))}
        </div>
      </div>

      {/* Table attribute editor (signature slide panel) */}
      <SlidePanel
        open={editingTable !== null}
        onClose={() => setEditingTableId(null)}
        side="right"
        title={editingTable ? `Table ${editingTable.table_number}` : ''}
      >
        {editingTable && (
          <>
            <div className="edit-row">
              <span className="edit-row__label">Seats</span>
              <span className="stepper">
                <button
                  className="stepper__btn"
                  aria-label="Fewer seats"
                  onClick={() =>
                    void updateTableAttrs(editingTable.id, {
                      seats: Math.max(1, editingTable.seats - 1),
                    })
                  }
                >
                  −
                </button>
                <span className="stepper__value">{editingTable.seats}</span>
                <button
                  className="stepper__btn"
                  aria-label="More seats"
                  onClick={() =>
                    void updateTableAttrs(editingTable.id, { seats: editingTable.seats + 1 })
                  }
                >
                  +
                </button>
              </span>
            </div>
            <div className="edit-row">
              <span className="edit-row__label">Shape</span>
              <span className="seg">
                {(['square', 'round'] as const).map((s) => (
                  <button
                    key={s}
                    className={cx('seg__opt', editingTable.shape === s && 'seg__opt--on')}
                    onClick={() => void updateTableAttrs(editingTable.id, { shape: s })}
                  >
                    {s === 'square' ? 'Square' : 'Round'}
                  </button>
                ))}
              </span>
            </div>
            <div className="edit-row">
              <span className="edit-row__label">Remove</span>
              <Button
                variant="danger"
                onClick={() => {
                  void removeTable(editingTable.id);
                  setEditingTableId(null);
                }}
              >
                Remove table
              </Button>
            </div>
          </>
        )}
      </SlidePanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface DraggableTableProps {
  table: RestaurantTable;
  editMode: boolean;
  orderTotal: number | undefined;
  onTap: (t: RestaurantTable) => void;
  onMove: (id: UUID, x: number, y: number) => void;
  onDrop: (id: UUID) => void;
}

const TAP_SLOP = 6; // px of movement below which a pointer interaction is a tap

function DraggableTable({ table, editMode, orderTotal, onTap, onMove, onDrop }: DraggableTableProps) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: table.position_x,
      origY: table.position_y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !editMode) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    setDragging(true);
    onMove(table.id, d.origX + dx, d.origY + dy);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.moved) {
      void onDrop(table.id);
    } else {
      onTap(table);
    }
  };

  const status = orderTotal !== undefined ? 'occupied' : 'free';

  return (
    <div
      className={cx('floor-table', editMode && 'floor-table--editing', dragging && 'floor-table--dragging')}
      style={{
        left: table.position_x,
        top: table.position_y,
        width: table.width,
        height: table.height,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <TableTile
        number={table.table_number}
        seats={table.seats}
        shape={table.shape}
        status={status}
        total={orderTotal}
      />
    </div>
  );
}
