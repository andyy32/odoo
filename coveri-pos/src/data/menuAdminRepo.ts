/*
 * COVERI POS — menu administration writes (manager-only screens).
 * Reads reuse loadCatalog (catalogRepo). All writes go through the offline
 * sync queue like every other mutation, with client-generated UUIDs.
 */

import { enqueueMutation } from '@/lib/syncQueue';
import type { Product, ProductCategory, UUID } from '@/types/db';

export function createCategory(cat: {
  company_id: UUID;
  name: string;
  sequence: number;
}): ProductCategory {
  const row: ProductCategory = { id: crypto.randomUUID(), color: null, ...cat };
  void enqueueMutation({ table: 'product_category', kind: 'insert', payload: row });
  return row;
}

export function updateCategory(id: UUID, patch: Partial<Pick<ProductCategory, 'name' | 'sequence'>>): void {
  void enqueueMutation({ table: 'product_category', kind: 'update', payload: patch, match: { column: 'id', value: id } });
}

export function createProduct(p: {
  company_id: UUID;
  category_id: UUID | null;
  name: string;
  price: number;
  prep_station: string | null;
}): Product {
  const row: Product = { id: crypto.randomUUID(), barcode: null, image: null, active: true, ...p };
  void enqueueMutation({ table: 'product', kind: 'insert', payload: row });
  return row;
}

export function updateProduct(
  id: UUID,
  patch: Partial<Pick<Product, 'name' | 'price' | 'category_id' | 'prep_station' | 'active'>>,
): void {
  void enqueueMutation({ table: 'product', kind: 'update', payload: patch, match: { column: 'id', value: id } });
}
