/*
 * COVERI POS — catalog data access (categories, products, taxes).
 * Loaded once per session and kept in memory; menus change rarely mid-service.
 */

import { supabase } from '@/lib/supabase';
import type { Tax as TaxRow, Product, ProductCategory, UUID } from '@/types/db';
import type { Tax } from '@/lib/tax';

export interface Catalog {
  categories: ProductCategory[];
  products: Product[];
  /** product id → taxes (in the shape the tax engine consumes). */
  taxesByProduct: Map<UUID, Tax[]>;
}

export async function loadCatalog(): Promise<Catalog> {
  const [catsRes, prodsRes, taxesRes, ptRes] = await Promise.all([
    supabase.from('product_category').select('*').order('sequence'),
    supabase.from('product').select('*').eq('active', true).order('name'),
    supabase.from('tax').select('*'),
    supabase.from('product_tax').select('*'),
  ]);
  const firstError = catsRes.error ?? prodsRes.error ?? taxesRes.error ?? ptRes.error;
  if (firstError) throw new Error(`Failed to load catalog: ${firstError.message}`);

  const taxById = new Map<UUID, Tax>();
  for (const t of (taxesRes.data ?? []) as TaxRow[]) {
    taxById.set(t.id, {
      id: t.id,
      name: t.name,
      amount: Number(t.amount),
      priceInclude: t.price_include,
    });
  }

  const taxesByProduct = new Map<UUID, Tax[]>();
  for (const link of (ptRes.data ?? []) as { product_id: UUID; tax_id: UUID }[]) {
    const tax = taxById.get(link.tax_id);
    if (!tax) continue;
    const list = taxesByProduct.get(link.product_id) ?? [];
    list.push(tax);
    taxesByProduct.set(link.product_id, list);
  }

  return {
    categories: (catsRes.data ?? []) as ProductCategory[],
    products: (prodsRes.data ?? []) as Product[],
    taxesByProduct,
  };
}
