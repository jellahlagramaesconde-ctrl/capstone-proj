CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password_hash   TEXT         NOT NULL,
    role            VARCHAR(20)  NOT NULL
                    CHECK (role IN ('Dept','Staff','PPO','President','Finance')),
    full_name       VARCHAR(150),
    email           VARCHAR(150),
    department      VARCHAR(50),         
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(LOWER(email));
CREATE TABLE IF NOT EXISTS password_resets (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(150) NOT NULL,
    otp_hash    TEXT         NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(LOWER(email));
CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (key, value)
VALUES ('worker_task_limit', '4')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS departments (
    id         SERIAL PRIMARY KEY,
    value      VARCHAR(50),
    name       VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE departments ADD COLUMN IF NOT EXISTS value VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_value ON departments(value);

INSERT INTO departments (value, name) VALUES
    ('vpaa', 'Office of the Vice President for Academic Affairs (VPAA)'),
    ('cfo', 'Christian Formation Office (CFO)'),
    ('registrar', 'Registrar Office'),
    ('finance-accounting', 'Finance and Accounting Department'),
    ('guidance-counseling', 'Guidance and Counseling Office'),
    ('scholarship', 'Scholarship Office'),
    ('nstp', 'National Service Training Program (NSTP)'),
    ('school-clinic', 'School Clinic Office'),
    ('cahs', 'College of Allied Health Sciences (CAHS)'),
    ('clia-ed', 'College of Liberal Arts-Education (CLIA-ED)'),
    ('ccje', 'College of Criminal Justice Education (CCJE) — COSCA Annex Campus (Campus II)'),
    ('cbe', 'College of Business Education (CBE)'),
    ('basic-ed-elem', 'Basic Education (Elementary)'),
    ('basic-ed-jshs', 'Basic Education (Junior and Senior High School levels)'),
    ('library', 'Library'),
    ('midwifery', 'Midwifery Department'),
    ('radtech', 'Radiologic Technology Department'),
    ('sports-development', 'Sports Development Office'),
    ('annex-campus', 'COSCA Annex Campus (Campus II)')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

-- Fixes the CCJE name on databases that already have the OLD name from a
-- prior run of this file. The INSERT above upserts by matching on `name`,
-- so simply changing the name string here would create a duplicate row
-- instead of renaming the existing one — this explicit UPDATE (keyed on
-- the stable `value` column instead) is what actually renames it safely,
-- and is harmless/idempotent to re-run on every server startup.
UPDATE departments
SET name = 'College of Criminal Justice Education (CCJE) — COSCA Annex Campus (Campus II)'
WHERE value = 'ccje';


CREATE TABLE IF NOT EXISTS job_types (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO job_types (name) VALUES
    ('Electrical'),
    ('Plumbing'),
    ('HVAC'),
    ('Carpentry'),
    ('Masonry'),
    ('General')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS staff (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) UNIQUE NOT NULL,
    specialty VARCHAR(100),
    tags      TEXT[]  DEFAULT '{}',
    workload  INT     DEFAULT 0,
    degree    VARCHAR(150),
    user_id   INT     REFERENCES users(id)
);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS degree VARCHAR(150);

CREATE TABLE IF NOT EXISTS skills (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

INSERT INTO skills (name) VALUES
    ('Electrical'), ('High Voltage'), ('Wiring'),
    ('Plumbing'), ('Drainage'), ('Water Pump'),
    ('HVAC'),
    ('Carpentry'), ('Masonry'), ('Locksmith'),
    ('General'), ('Painting'), ('Appliance Repair')
ON CONFLICT (name) DO NOTHING;


INSERT INTO skills (name)
SELECT DISTINCT unnest(tags) FROM staff WHERE tags IS NOT NULL
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS staff_skills (
    staff_id          INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    skill_id          INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INT DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
    years_experience  NUMERIC(4,1) DEFAULT 0,
    PRIMARY KEY (staff_id, skill_id)
);

INSERT INTO staff_skills (staff_id, skill_id)
SELECT s.id, sk.id
FROM staff s
CROSS JOIN LATERAL unnest(s.tags) AS tag_name
JOIN skills sk ON sk.name = tag_name
ON CONFLICT (staff_id, skill_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS job_type_skill_requirements (
    job_type_id  INT NOT NULL REFERENCES job_types(id) ON DELETE CASCADE,
    skill_id     INT NOT NULL REFERENCES skills(id)    ON DELETE CASCADE,
    min_headcount INT DEFAULT 1,
    PRIMARY KEY (job_type_id, skill_id)
);


INSERT INTO job_type_skill_requirements (job_type_id, skill_id, min_headcount)
SELECT jt.id, sk.id, 1
FROM job_types jt
JOIN skills sk ON sk.name = jt.name
ON CONFLICT (job_type_id, skill_id) DO NOTHING;

INSERT INTO job_type_skill_requirements (job_type_id, skill_id, min_headcount)
SELECT jt.id, sk.id, 1
FROM job_types jt
JOIN skills sk ON (
    (jt.name = 'Electrical' AND sk.name IN ('High Voltage', 'Wiring')) OR
    (jt.name = 'Plumbing'   AND sk.name IN ('Drainage', 'Water Pump')) OR
    (jt.name = 'Carpentry'  AND sk.name IN ('Masonry', 'Locksmith')) OR
    (jt.name = 'Masonry'    AND sk.name IN ('Carpentry')) OR
    (jt.name = 'General'    AND sk.name IN ('Painting', 'Appliance Repair'))
)
ON CONFLICT (job_type_id, skill_id) DO NOTHING;


CREATE SEQUENCE IF NOT EXISTS job_orders_id_seq START 141;

CREATE TABLE IF NOT EXISTS job_orders (
    id               TEXT         PRIMARY KEY
                     DEFAULT ('JO-' || to_char(CURRENT_DATE,'YYYY') || '-0' || nextval('job_orders_id_seq')::text),
    office           VARCHAR(150) NOT NULL,
    department_id    INT          REFERENCES departments(id),
    description      TEXT         NOT NULL,

    job_type         VARCHAR(50)  DEFAULT 'General',
    job_type_id      INT          REFERENCES job_types(id),

    safety_risk          INT DEFAULT 1,
    operational_impact   INT DEFAULT 1,
    urgency              INT DEFAULT 1,
    people_affected      INT DEFAULT 1,
    resource_cost        INT DEFAULT 1,
    priority_score       INT DEFAULT 10,

    status               VARCHAR(20)  DEFAULT 'Pending',
    assigned_staff       VARCHAR(100) DEFAULT 'Unassigned',
    assigned_staff_id    INT          REFERENCES staff(id),
    match_score          INT          DEFAULT 0,

    date_submitted   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_completed   TIMESTAMP,

    notes            TEXT,
    is_emergency     BOOLEAN DEFAULT FALSE,

    ppo_approved         BOOLEAN DEFAULT FALSE,
    school_head_approved BOOLEAN DEFAULT FALSE,
    finance_approved     BOOLEAN DEFAULT FALSE,

    emergency_bypassed   BOOLEAN DEFAULT FALSE,

    estimated_cost   NUMERIC(12,2),  
    approved_amount  NUMERIC(12,2),  
    finance_notes    TEXT,

    requested_by_user_id INT REFERENCES users(id),
    requested_by_name    VARCHAR(150),

    photo_url        TEXT
);

ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE TABLE IF NOT EXISTS job_order_photos (
    id           SERIAL PRIMARY KEY,
    job_order_id TEXT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    photo_url    TEXT NOT NULL,
    position     INT  DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_order_photos_job_order_id ON job_order_photos(job_order_id);

INSERT INTO job_order_photos (job_order_id, photo_url, position)
SELECT jo.id, jo.photo_url, 0
FROM job_orders jo
WHERE jo.photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_order_photos jop WHERE jop.job_order_id = jo.id
  );

CREATE INDEX IF NOT EXISTS idx_job_orders_status              ON job_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_orders_ppo_approved        ON job_orders(ppo_approved);
CREATE INDEX IF NOT EXISTS idx_job_orders_school_head_approved ON job_orders(school_head_approved);
CREATE INDEX IF NOT EXISTS idx_job_orders_finance_approved    ON job_orders(finance_approved);
CREATE INDEX IF NOT EXISTS idx_job_orders_department_id       ON job_orders(department_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_assigned_staff_id   ON job_orders(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_date_submitted      ON job_orders(date_submitted DESC);
CREATE INDEX IF NOT EXISTS idx_job_orders_is_emergency        ON job_orders(is_emergency);

INSERT INTO departments (name)
SELECT DISTINCT office FROM job_orders WHERE office IS NOT NULL
ON CONFLICT (name) DO NOTHING;

UPDATE job_orders jo
SET department_id = d.id
FROM departments d
WHERE jo.office = d.name AND jo.department_id IS NULL;

UPDATE job_orders jo
SET job_type_id = jt.id
FROM job_types jt
WHERE jo.job_type = jt.name AND jo.job_type_id IS NULL;

UPDATE job_orders jo
SET assigned_staff_id = s.id
FROM staff s
WHERE jo.assigned_staff = s.name AND jo.assigned_staff_id IS NULL;

CREATE TABLE IF NOT EXISTS job_order_staff (
    job_order_id TEXT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    staff_id     INT  NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    is_lead      BOOLEAN DEFAULT FALSE,
    match_score  INT DEFAULT 0,
    assigned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_order_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_job_order_staff_staff_id     ON job_order_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_job_order_staff_job_order_id ON job_order_staff(job_order_id);
INSERT INTO job_order_staff (job_order_id, staff_id, is_lead, match_score)
SELECT id, assigned_staff_id, TRUE, match_score
FROM job_orders
WHERE assigned_staff_id IS NOT NULL
ON CONFLICT (job_order_id, staff_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS logs (
    id         SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message    TEXT,
    ticket_id  TEXT REFERENCES job_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_logs_ticket_id ON logs(ticket_id);
CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message     TEXT,
    role        VARCHAR(20),
    ticket_id   TEXT REFERENCES job_orders(id) ON DELETE CASCADE
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ticket_id TEXT REFERENCES job_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE TABLE IF NOT EXISTS external_providers (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    contact_info TEXT,
    specialty    VARCHAR(100),
    verified     BOOLEAN   DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_order_provider_assignment (
    job_order_id TEXT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    provider_id  INT  NOT NULL REFERENCES external_providers(id) ON DELETE CASCADE,
    assigned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_order_id, provider_id)
);

CREATE TABLE IF NOT EXISTS budget_allocations (
    id               SERIAL PRIMARY KEY,
    department_id    INT  NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    fiscal_year      INT  NOT NULL,
    allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    spent_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency         CHAR(3)       NOT NULL DEFAULT 'PHP',
    UNIQUE (department_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS approval_audit_log (
    id             SERIAL PRIMARY KEY,
    job_order_id   TEXT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    actor_user_id  INT  REFERENCES users(id),
    action         VARCHAR(50) NOT NULL,  
    previous_value TEXT,
    new_value      TEXT,
    reason         TEXT,
    amount_php     NUMERIC(12,2),         
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_job_order_id ON approval_audit_log(job_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON approval_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON approval_audit_log(action);
ALTER TABLE approval_audit_log ADD COLUMN IF NOT EXISTS amount_php NUMERIC(12,2);

-- ---------------------------------------------------------------
-- BUDGET REQUISITION LINE ITEMS
-- Mirrors the PPO's paper "Budget Requisition Form" (item no., qty,
-- unit, description, unit cost) — one set of rows per job order.
-- Only the PPO writes to this table; Finance/President read it
-- alongside the job order's existing estimated_cost/approved_amount/
-- finance_notes fields, which already serve as the single-figure
-- request/approval amounts (no per-item "approved" columns needed).
-- job_order_id has no UNIQUE constraint on its own — a job order can
-- have many item rows — but each job order's item list is replaced
-- as a whole (delete+insert) rather than patched row by row, so the
-- API layer enforces "one requisition per job order" in practice.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_requisition_items (
    id            SERIAL PRIMARY KEY,
    job_order_id  TEXT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    item_no       INT NOT NULL,
    qty           NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit          VARCHAR(20),
    description   TEXT NOT NULL,
    unit_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_req_items_job_order_id ON budget_requisition_items(job_order_id);