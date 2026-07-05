/*
 * COVERI POS — data repository.
 *
 * Thin, typed data-access layer over Supabase. Screens talk to this module
 * (via stores), never to supabase-js directly, so the Phase-7 offline queue
 * can slot in underneath without touching UI code.
 */

import { supabase } from '@/lib/supabase';
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
  const [cfgRes, floorsRes, tablesRes, ordersRes] = await Promise.all([
    supabase.from('pos_config').select('*').limit(1).maybeSingle(),
    supabase.from('restaurant_floor').select('*').order('sequence'),
    supabase.from('restaurant_table').select('*').eq('active', true),
    supabase.from('pos_order').select('*').eq('state', 'draft'),
  ]);

  const firstError = cfgRes.error ?? floorsRes.error ?? tablesRes.error ?? ordersRes.error;
  if (firstError) throw new Error(`Failed to load floor data: ${firstError.message}`);

  const draftOrdersByTable = new Map<UUID, PosOrder>();
  for (const o of (ordersRes.data ?? []) as PosOrder[]) {
    if (o.table_id) draftOrdersByTable.set(o.table_id, o);
  }

  return {
    config: (cfgRes.data as PosConfig | null) ?? null,
    floors: (floorsRes.data ?? []) as RestaurantFloor[],
    tables: (tablesRes.data ?? []) as RestaurantTable[],
    draftOrdersByTable,
  };
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
  const { error } = await supabase.from('restaurant_table').update(patch).eq('id', id);
  if (error) throw new Error(`Failed to update table: ${error.message}`);
}

export async function createTable(
  table: Omit<RestaurantTable, 'id' | 'active' | 'color'> & Partial<Pick<RestaurantTable, 'color'>>,
): Promise<RestaurantTable> {
  const { data, error } = await supabase
    .from('restaurant_table')
    .insert(table)
    .select()
    .single();
  if (error) throw new Error(`Failed to create table: ${error.message}`);
  return data as RestaurantTable;
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
