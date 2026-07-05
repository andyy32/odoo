/*
 * COVERI POS — floor state store (zustand).
 * Holds floors/tables/draft-orders + edit mode; delegates persistence to repo.
 */

import { create } from 'zustand';
import {
  createTable,
  loadFloorData,
  subscribeFloorChanges,
  updateTable,
} from '@/data/repo';
import type { PosConfig, PosOrder, RestaurantFloor, RestaurantTable, UUID } from '@/types/db';

export const GRID = 20; // px grid snap in edit mode

interface FloorState {
  loading: boolean;
  error: string | null;
  config: PosConfig | null;
  floors: RestaurantFloor[];
  tables: RestaurantTable[];
  draftOrdersByTable: Map<UUID, PosOrder>;
  activeFloorId: UUID | null;
  editMode: boolean;

  load: () => Promise<void>;
  startLive: () => () => void;
  setActiveFloor: (id: UUID) => void;
  toggleEditMode: () => void;
  /** Optimistically move a table locally (during drag). */
  moveTableLocal: (id: UUID, x: number, y: number) => void;
  /** Persist the final position (drag end). */
  commitTablePosition: (id: UUID) => Promise<void>;
  updateTableAttrs: (
    id: UUID,
    patch: Partial<Pick<RestaurantTable, 'seats' | 'shape' | 'table_number'>>,
  ) => Promise<void>;
  addTable: () => Promise<void>;
  removeTable: (id: UUID) => Promise<void>;
}

export const useFloorStore = create<FloorState>((set, get) => ({
  loading: true,
  error: null,
  config: null,
  floors: [],
  tables: [],
  draftOrdersByTable: new Map(),
  activeFloorId: null,
  editMode: false,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await loadFloorData();
      set((s) => ({
        loading: false,
        config: data.config,
        floors: data.floors,
        tables: data.tables,
        draftOrdersByTable: data.draftOrdersByTable,
        activeFloorId: s.activeFloorId ?? data.floors[0]?.id ?? null,
      }));
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  startLive: () => {
    // Re-load on any remote change. Coarse but correct; refined per-row
    // patching can come with the offline layer.
    return subscribeFloorChanges(() => {
      if (!get().editMode) void get().load();
    });
  },

  setActiveFloor: (id) => set({ activeFloorId: id }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  moveTableLocal: (id, x, y) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === id ? { ...t, position_x: x, position_y: y } : t,
      ),
    })),

  commitTablePosition: async (id) => {
    const t = get().tables.find((t) => t.id === id);
    if (!t) return;
    const x = Math.max(0, Math.round(t.position_x / GRID) * GRID);
    const y = Math.max(0, Math.round(t.position_y / GRID) * GRID);
    get().moveTableLocal(id, x, y);
    await updateTable(id, { position_x: x, position_y: y });
  },

  updateTableAttrs: async (id, patch) => {
    set((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    await updateTable(id, patch);
  },

  addTable: async () => {
    const { activeFloorId, floors, tables } = get();
    const floor = floors.find((f) => f.id === activeFloorId);
    if (!floor) return;
    const onFloor = tables.filter((t) => t.floor_id === floor.id);
    // Next free number + a simple cascade placement.
    const nextNum = String(
      onFloor.reduce((m, t) => Math.max(m, parseInt(t.table_number.replace(/\D/g, '') || '0', 10)), 0) + 1,
    );
    const created = await createTable({
      company_id: floor.company_id,
      floor_id: floor.id,
      table_number: nextNum,
      shape: 'square',
      position_x: 40 + (onFloor.length % 4) * 160,
      position_y: 40 + Math.floor(onFloor.length / 4) * 160,
      width: 120,
      height: 120,
      seats: 4,
    });
    set((s) => ({ tables: [...s.tables, created] }));
  },

  removeTable: async (id) => {
    set((s) => ({ tables: s.tables.filter((t) => t.id !== id) }));
    await updateTable(id, { active: false });
  },
}));
