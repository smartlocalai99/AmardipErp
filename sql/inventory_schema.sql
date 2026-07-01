CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Nos',
  stock_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('receipt', 'issue', 'return', 'adjustment')),
  quantity_delta NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_complaint_id ON inventory_transactions(complaint_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);

CREATE TABLE IF NOT EXISTS material_requests (
  id SERIAL PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_quantity NUMERIC(12,2) NOT NULL,
  issued_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partially_issued', 'issued')),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_requests_complaint_id ON material_requests(complaint_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
