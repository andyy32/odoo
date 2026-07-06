/*
 * COVERI POS — data repository.
 *
 * Thin, typed data-access layer over Supabase. Screens talk to this module
 * (via stores), never to supabase-js directly. Writes go through the offline
 * sync queue (persisted, replayed in order); bulk reads are network-first
 * with an IndexedDB fallback so the app renders after an offline reload.
 */

import { supabase } from '@/lib/supabase';
import { cachedRead } from '@/lib/cachedRead';
import { enqueueMutation } from '@/lib/syncQueue';
import type {
  PosConfig,
  PosOrder,
  RestaurantFloor,
  RestaurantTable,
  UUID,
} from '@/types/db';

export interface FloorData {
  config: PosConfig | null;
  floors: RestaurantFloor[];
  tables: RestaurantTable[];
  /** Draft orders, keyed by table id (one active order per table in V1). */
  draftOrdersByTable: Map<UUID, PosOrder>;
}

export async function loadFloorData(): Promise<FloorData> {
  const raw = await cachedRead('floorData', async () => {
    const [cfgRes, floorsRes, tablesRes, ordersRes] = await Promise.all([
      supabase.from('pos_config').select('*').limit(1).maybeSingle(),
      supabase.from('restaurant_floor').select('*').order('sequence'),
      supabase.from('restaurant_table').select('*').eq('active', true),
      supabase.from('pos_order').select('*').eq('state', 'draft'),
    ]);
    const firstError = cfgRes.error ?? floorsRes.error ?? tablesRes.error ?? ordersRes.error;
    if (firstError) throw new Error(`Failed to load floor data: ${firstError.message}`);
    return {
      config: (cfgRes.data as PosConfig | null) ?? null,
      floors: (floorsRes.data ?? []) as RestaurantFloor[],
      tables: (tablesRes.data ?? []) as RestaurantTable[],
      draftOrders: (ordersRes.data ?? []) as PosOrder[],
    };
  });

  const draftOrdersByTable = new Map<UUID, PosOrder>();
  for (const o of raw.draftOrders) {
    if (o.table_id) draftOrdersByTable.set(o.table_id, o);
  }
  return { config: raw.config, floors: raw.floors, tables: raw.tables, draftOrdersByTable };
}

/** Persist a table's geometry/attributes (edit mode). */
export async function updateTable(
  id: UUID,
  patch: Partial<
    Pick<
      RestaurantTable,
      'position_x' | 'position_y' | 'width' | 'height' | 'seats' | 'shape' | 'table_number' | 'active'
    >
  >,
): Promise<void> {
  await enqueueMutation({
    table: 'restaurant_table',
    kind: 'update',
    payload: patch,
    match: { column: 'id', value: id },
  });
}

export async function createTable(
  table: Omit<RestaurantTable, 'id' | 'active' | 'color'> & Partial<Pick<RestaurantTable, 'color'>>,
): Promise<RestaurantTable> {
  const row: RestaurantTable = { id: crypto.randomUUID(), active: true, color: '#262626', ...table };
  await enqueueMutation({ table: 'restaurant_table', kind: 'insert', payload: row });
  return row;
}

/**
 * Subscribe to live floor changes (tables moved, orders opened/paid on other
 * devices). Returns an unsubscribe function.
 */
export function subscribeFloorChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('floor-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_table' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_order' }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
