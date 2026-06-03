-- 預售屋備查建案資料表（核准總戶數）
CREATE TABLE IF NOT EXISTS presale_projects (
  project_name  TEXT PRIMARY KEY,
  district      TEXT,
  total_units   INT,
  builder       TEXT,
  address       TEXT,
  declare_date  TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presale_projects_district
  ON presale_projects (district);
