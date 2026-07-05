// COVERI POS — domain types (mirror the Supabase schema in 0001_core_schema.sql).
// Hand-written for V1; can be replaced by `supabase gen types` once a live
// project is provisioned.

export type UUID = string;

export interface Company {
  id: UUID;
  name: string;
  currency: string;
  currency_symbol: string;
}

export type StaffRole = 'waiter' | 'manager' | 'admin';

export interface Staff {
  id: UUID;
  company_id: UUID;
  user_id: UUID | null;
  name: string;
  role: StaffRole;
  active: boolean;
}

export interface PosConfig {
  id: UUID;
  company_id: UUID;
  name: string;
  iface_printbill: boolean;
  iface_splitbill: boolean;
}

export type SessionState = 'opened' | 'closing' | 'closed';

export interface PosSession {
  id: UUID;
  company_id: UUID;
  config_id: UUID;
  opened_by: UUID | null;
  state: SessionState;
  opening_cash: number;
  closing_cash: number | null;
  opened_at: string;
  closed_at: string | null;
}

export interface RestaurantFloor {
  id: UUID;
  company_id: UUID;
  config_id: UUID;
  name: string;
  background_image: string | null;
  background_color: string | null;
  sequence: number;
}

export type TableShape = 'square' | 'round';

export interface RestaurantTable {
  id: UUID;
  company_id: UUID;
  floor_id: UUID;
  table_number: string;
  shape: TableShape;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  seats: number;
  color: string | null;
  active: boolean;
}

export interface Tax {
  id: UUID;
  company_id: UUID;
  name: string;
  amount: number;
  price_include: boolean;
}

export interface ProductCategory {
  id: UUID;
  company_id: UUID;
  name: string;
  sequence: number;
  color: string | null;
}

export interface Product {
  id: UUID;
  company_id: UUID;
  category_id: UUID | null;
  name: string;
  price: number;
  barcode: string | null;
  image: string | null;
  prep_station: string | null;
  active: boolean;
}

export type OrderState = 'draft' | 'paid' | 'done' | 'cancelled';

export interface PosOrder {
  id: UUID;
  company_id: UUID;
  session_id: UUID | null;
  table_id: UUID | null;
  waiter_id: UUID | null;
  customer_count: number;
  state: OrderState;
  prep_snapshot: PrepSnapshotEntry[];
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  sequence_number: number | null;
  pos_reference: string | null;
}

export interface PosOrderLine {
  id: UUID;
  order_id: UUID;
  product_id: UUID | null;
  full_product_name: string;
  qty: number;
  price_unit: number;
  discount: number;
  note: string | null;
}

/** One entry in an order's kitchen snapshot — used by the change-delta engine. */
export interface PrepSnapshotEntry {
  lineId: UUID;
  name: string;
  qty: number;
  note: string | null;
  station: string;
}

export interface KitchenTicketItem {
  kind: 'add' | 'cancel' | 'note';
  name: string;
  qty: number;
  note: string | null;
}

export interface KitchenTicket {
  id: UUID;
  company_id: UUID;
  order_id: UUID | null;
  table_number: string;
  station: string;
  items: KitchenTicketItem[];
  done: boolean;
  fired_at: string;
}

export interface PosPaymentMethod {
  id: UUID;
  company_id: UUID;
  name: string;
  type: 'cash' | 'card' | 'other';
  is_cash: boolean;
  sequence: number;
}

export interface PosPayment {
  id: UUID;
  order_id: UUID;
  method_id: UUID | null;
  amount: number;
}
