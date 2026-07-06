import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './settings.css';
import { Button, SlidePanel } from '@/components/primitives';
import { loadCatalog, type Catalog } from '@/data/catalogRepo';
import { createProduct, updateProduct } from '@/data/menuAdminRepo';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/money';
import type { Product, ProductCategory, UUID } from '@/types/db';

type Draft = {
  id?: UUID;
  name: string;
  price: string;
  category_id: UUID | null;
  prep_station: string | null;
  active: boolean;
};

const STATIONS = ['kitchen', 'bar', 'none'] as const;

/**
 * Settings — Menu management (manager-gated). Lists categories & products,
 * with a slide-in editor to add/edit price, category, prep station, and
 * active flag. Writes go through the offline queue; edits appear on the
 * order screen after its catalog reloads.
 */
export function SettingsScreen() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [companyId, setCompanyId] = useState<UUID | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);

  const reload = () =>
    void loadCatalog().then((c) => {
      setCatalog(c);
      setProducts(c.products);
      setCompanyId(c.products[0]?.company_id ?? c.categories[0]?.company_id ?? null);
    });

  useEffect(() => {
    reload();
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category_id ?? 'uncat';
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [products]);

  const openNew = () =>
    setEditing({ name: '', price: '', category_id: catalog?.categories[0]?.id ?? null, prep_station: 'kitchen', active: true });

  const openEdit = (p: Product) =>
    setEditing({
      id: p.id,
      name: p.name,
      price: String(p.price),
      category_id: p.category_id,
      prep_station: p.prep_station,
      active: p.active,
    });

  const save = () => {
    if (!editing || !companyId) return;
    const price = parseFloat(editing.price) || 0;
    const station = editing.prep_station === 'none' ? null : editing.prep_station;
    if (editing.id) {
      updateProduct(editing.id, {
        name: editing.name.trim(),
        price,
        category_id: editing.category_id,
        prep_station: station,
        active: editing.active,
      });
      setProducts((ps) =>
        ps.map((p) =>
          p.id === editing.id
            ? { ...p, name: editing.name.trim(), price, category_id: editing.category_id, prep_station: station, active: editing.active }
            : p,
        ),
      );
    } else {
      const created = createProduct({
        company_id: companyId,
        category_id: editing.category_id,
        name: editing.name.trim() || 'New item',
        price,
        prep_station: station,
      });
      setProducts((ps) => [...ps, created]);
    }
    setEditing(null);
  };

  if (!catalog) return <div className="pay-status">Loading settings…</div>;

  const catName = (id: string) =>
    id === 'uncat' ? 'Uncategorized' : catalog.categories.find((c) => c.id === id)?.name ?? 'Category';

  return (
    <div className="settings">
      <div className="settings__head">
        <span className="settings__title">Menu</span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Floor
          </Button>
          <Button variant="primary" onClick={openNew}>
            + Item
          </Button>
        </div>
      </div>
      <p className="settings__note">
        Edit prices, categories, and kitchen routing. Floors &amp; tables are edited on the Floor screen's Edit mode.
      </p>

      {[...byCategory.entries()]
        .sort((a, b) => catName(a[0]).localeCompare(catName(b[0])))
        .map(([catId, items]) => (
          <div className="menu-cat" key={catId}>
            <div className="menu-cat__head">
              <span className="menu-cat__name">{catName(catId)}</span>
              <span className="menu-row__meta">{items.length} items</span>
            </div>
            {items
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <button key={p.id} className={cx('menu-row', !p.active && 'menu-row--off')} onClick={() => openEdit(p)}>
                  <span>
                    <span className="menu-row__name">{p.name}</span>
                    <span className="menu-row__meta">
                      {' '}
                      · {p.prep_station ?? 'no station'}
                      {!p.active && ' · hidden'}
                    </span>
                  </span>
                  <span className="menu-row__price numeric">{formatMoney(Number(p.price))}</span>
                </button>
              ))}
          </div>
        ))}

      <SlidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        side="right"
        title={editing?.id ? 'Edit item' : 'New item'}
        footer={
          editing && (
            <div className="editor__footer">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save}>
                Save
              </Button>
            </div>
          )
        }
      >
        {editing && (
          <MenuItemEditor draft={editing} categories={catalog.categories} onChange={setEditing} />
        )}
      </SlidePanel>
    </div>
  );
}

function MenuItemEditor({
  draft,
  categories,
  onChange,
}: {
  draft: Draft;
  categories: ProductCategory[];
  onChange: (d: Draft) => void;
}) {
  return (
    <>
      <div className="editor__field">
        <label className="editor__label" htmlFor="p-name">
          Name
        </label>
        <input
          id="p-name"
          className="editor__input"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="editor__field">
        <label className="editor__label" htmlFor="p-price">
          Price
        </label>
        <input
          id="p-price"
          className="editor__input numeric"
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => onChange({ ...draft, price: e.target.value })}
        />
      </div>
      <div className="editor__field">
        <span className="editor__label">Category</span>
        <div className="editor__seg">
          {categories.map((c) => (
            <button
              key={c.id}
              className={cx('editor__chip', draft.category_id === c.id && 'editor__chip--on')}
              onClick={() => onChange({ ...draft, category_id: c.id })}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="editor__field">
        <span className="editor__label">Kitchen routing</span>
        <div className="editor__seg">
          {STATIONS.map((s) => (
            <button
              key={s}
              className={cx('editor__chip', (draft.prep_station ?? 'none') === s && 'editor__chip--on')}
              onClick={() => onChange({ ...draft, prep_station: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="editor__field">
        <span className="editor__label">Visibility</span>
        <div className="editor__seg">
          <button
            className={cx('editor__chip', draft.active && 'editor__chip--on')}
            onClick={() => onChange({ ...draft, active: true })}
          >
            On menu
          </button>
          <button
            className={cx('editor__chip', !draft.active && 'editor__chip--on')}
            onClick={() => onChange({ ...draft, active: false })}
          >
            Hidden
          </button>
        </div>
      </div>
    </>
  );
}
