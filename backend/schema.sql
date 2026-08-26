-- ============================================================
-- JORS COSCA — PostgreSQL Schema
-- Colegio de Santa Catalina de Alejandria (COSCA)
-- Physical Plant Office — Job Order Request System
--
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
-- Run once per fresh deployment, then applySchemaMigrations() in
-- server.ts keeps it idempotent on every subsequent restart.
-- ============================================================

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password_hash   TEXT         NOT NULL,
    role            VARCHAR(20)  NOT NULL
                    CHECK (role IN ('Dept','Staff','PPO','President','Finance')),
    full_name       VARCHAR(150),
    email           VARCHAR(150),
    department      VARCHAR(50),  -- office this Dept account is locked to (e.g. "vpaa", "registrar"); NULL for non-Dept roles
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- For deployments where `users` already exists from before this column existed
-- (CREATE TABLE IF NOT EXISTS above won't add it to an already-created table).
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(LOWER(email));


-- ============================================================
-- 1b. PASSWORD RESETS
-- Stores hashed OTP codes for the "Forgot Password" flow.
-- Replaces the old in-memory Map — survives server restarts,
-- which matters once this is deployed on a host that sleeps
-- between requests (e.g. Render's free tier).
-- ============================================================
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


-- ============================================================
-- 1c. APP SETTINGS
-- Generic key/value store for admin-configurable system settings — e.g.
-- the maintenance staff task capacity limit. This used to live only in
-- the PPO's browser localStorage, which meant it never reached the
-- server, was never enforced, and reset per-device. Persisting it here
-- lets the backend actually read and enforce it for every user.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (key, value)
VALUES ('worker_task_limit', '4')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 2. DEPARTMENTS
-- Normalized table for office / department names. `value` is the short
-- slug used everywhere else in the app (users.department, login dropdowns);
-- `name` is the full display label used on job_orders.office and in the UI.
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    id         SERIAL PRIMARY KEY,
    value      VARCHAR(50),
    name       VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- For deployments where `departments` already exists from before this
-- column existed (CREATE TABLE IF NOT EXISTS above won't add it).
ALTER TABLE departments ADD COLUMN IF NOT EXISTS value VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_value ON departments(value);

-- Conflict-target `name`, not `value`: deployments that had this table
-- before the `value` column existed already have rows like "Registrar
-- Office" with value = NULL, which only violates the NAME constraint on
-- re-seed — targeting `value` here would miss that conflict entirely and
-- error out. This backfills `value` onto those pre-existing rows instead.
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
    ('ccje', 'College of Criminal Justice Education (CCJE)'),
    ('cbe', 'College of Business Education (CBE)'),
    ('basic-ed-elem', 'Basic Education (Elementary)'),
    ('basic-ed-jshs', 'Basic Education (Junior and Senior High School levels)')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;


-- ============================================================
-- 3. JOB TYPES
-- ============================================================
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


-- ============================================================
-- 4. STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) UNIQUE NOT NULL,
    specialty VARCHAR(100),
    tags      TEXT[]  DEFAULT '{}',
    workload  INT     DEFAULT 0,
    degree    VARCHAR(150),                  -- highest relevant qualification, e.g. "TESDA NC II Electrical Installation"
    user_id   INT     REFERENCES users(id)   -- linked once seed-users runs
);

-- For deployments where `staff` already exists from before this column
-- existed (CREATE TABLE IF NOT EXISTS above won't add it to an
-- already-created table).
ALTER TABLE staff ADD COLUMN IF NOT EXISTS degree VARCHAR(150);

-- NOTE: no hardcoded technicians are seeded here on purpose. Staff rows are
-- created exclusively by the app (server.ts, POST /api/users with role
-- "Staff"), which links each row to a real user_id. Seeding fake names here
-- used to make the Staff Workload Roster show technicians nobody had
-- actually created an account for.


-- ============================================================
-- 5. SKILLS & COMPETENCY
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Base skill vocabulary. Seeded directly (not derived from staff.tags —
-- staff no longer come pre-seeded, so that derivation alone would leave
-- this table empty on a fresh deploy with 0 real accounts created yet).
INSERT INTO skills (name) VALUES
    ('Electrical'), ('High Voltage'), ('Wiring'),
    ('Plumbing'), ('Drainage'), ('Water Pump'),
    ('HVAC'),
    ('Carpentry'), ('Masonry'), ('Locksmith'),
    ('General'), ('Painting'), ('Appliance Repair')
ON CONFLICT (name) DO NOTHING;

-- Still also pick up any ad-hoc skills a staff member's tags introduce
-- that aren't in the base vocabulary above (runs safely on every boot).
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

-- This was the actual missing piece: without these rows, matchStaffForJobType()
-- in server.ts can never find a qualified technician for ANY job type — the
-- join always returns 0 rows, so every job order fell through to "Outsource"
-- regardless of which staff existed or what skills they had. Each job type
-- maps to the skill of the same name (Electrical -> Electrical, etc.), plus
-- the related specialty skills so a broader match is possible.
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


-- ============================================================
-- 6. JOB ORDERS (main request table)
-- ============================================================
-- Ticket IDs: JO-YYYY-NNNN, starts at 0141 to match existing records.
CREATE SEQUENCE IF NOT EXISTS job_orders_id_seq START 141;

CREATE TABLE IF NOT EXISTS job_orders (
    -- Identity
    id               TEXT         PRIMARY KEY
                     DEFAULT ('JO-' || to_char(CURRENT_DATE,'YYYY') || '-0' || nextval('job_orders_id_seq')::text),
    office           VARCHAR(150) NOT NULL,        -- free-text (legacy compat)
    department_id    INT          REFERENCES departments(id),
    description      TEXT         NOT NULL,

    -- Classification
    job_type         VARCHAR(50)  DEFAULT 'General',
    job_type_id      INT          REFERENCES job_types(id),

    -- Priority factors (1–5 scale each, except people_affected 1–500)
    safety_risk          INT DEFAULT 1,
    operational_impact   INT DEFAULT 1,
    urgency              INT DEFAULT 1,
    people_affected      INT DEFAULT 1,
    resource_cost        INT DEFAULT 1,
    priority_score       INT DEFAULT 10,

    -- Status & assignment
    status               VARCHAR(20)  DEFAULT 'Pending',
    assigned_staff       VARCHAR(100) DEFAULT 'Unassigned',  -- legacy free text
    assigned_staff_id    INT          REFERENCES staff(id),
    match_score          INT          DEFAULT 0,

    -- Dates
    date_submitted   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_completed   TIMESTAMP,

    -- PPO assessment
    notes            TEXT,
    is_emergency     BOOLEAN DEFAULT FALSE,

    -- Three-stage approval flags
    ppo_approved         BOOLEAN DEFAULT FALSE,
    school_head_approved BOOLEAN DEFAULT FALSE,
    finance_approved     BOOLEAN DEFAULT FALSE,

    -- TRUE only when PPO approved this as an emergency and School Head /
    -- Finance sign-off were auto-set rather than genuinely reviewed.
    -- Kept separate from is_emergency (a Dept/PPO *label*) because a
    -- ticket can be labeled emergency without ever reaching this branch,
    -- and this flag is what School Head/Finance dashboards key off of to
    -- surface "you were bypassed on this one" instead of inferring it.
    emergency_bypassed   BOOLEAN DEFAULT FALSE,

    -- Finance cost fields (Philippine Pesos)
    estimated_cost   NUMERIC(12,2),   -- PPO or Finance initial estimate
    approved_amount  NUMERIC(12,2),   -- Finance final release amount
    finance_notes    TEXT,

    -- Requester
    requested_by_user_id INT REFERENCES users(id),
    requested_by_name    VARCHAR(150),

    -- Optional photo attached at submission time (stored as base64 data URL
    -- or a hosted URL, depending on how the backend saves uploads).
    photo_url        TEXT
);

-- For deployments where `job_orders` already existed before this column
-- was added (CREATE TABLE IF NOT EXISTS above won't retrofit it).
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_job_orders_status              ON job_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_orders_ppo_approved        ON job_orders(ppo_approved);
CREATE INDEX IF NOT EXISTS idx_job_orders_school_head_approved ON job_orders(school_head_approved);
CREATE INDEX IF NOT EXISTS idx_job_orders_finance_approved    ON job_orders(finance_approved);
CREATE INDEX IF NOT EXISTS idx_job_orders_department_id       ON job_orders(department_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_assigned_staff_id   ON job_orders(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_date_submitted      ON job_orders(date_submitted DESC);
CREATE INDEX IF NOT EXISTS idx_job_orders_is_emergency        ON job_orders(is_emergency);

-- Back-fill department_id from the free-text office column (safe on repeated runs)
INSERT INTO departments (name)
SELECT DISTINCT office FROM job_orders WHERE office IS NOT NULL
ON CONFLICT (name) DO NOTHING;

UPDATE job_orders jo
SET department_id = d.id
FROM departments d
WHERE jo.office = d.name AND jo.department_id IS NULL;

-- Back-fill job_type_id from free-text job_type column
UPDATE job_orders jo
SET job_type_id = jt.id
FROM job_types jt
WHERE jo.job_type = jt.name AND jo.job_type_id IS NULL;

-- Back-fill assigned_staff_id from free-text assigned_staff column
UPDATE job_orders jo
SET assigned_staff_id = s.id
FROM staff s
WHERE jo.assigned_staff = s.name AND jo.assigned_staff_id IS NULL;


-- ============================================================
-- 6b. JOB ORDER STAFF ASSIGNMENTS — multi-technician dispatch
-- A job order can now be staffed by more than one technician. PPO/AI
-- decides team size per request (based on urgency, safety risk, and
-- people affected — not job type alone), for every request, not just
-- emergencies: a bad electrical fault or a big leak needs a second pair
-- of hands whether or not it's flagged emergency.
--
-- job_orders.assigned_staff / assigned_staff_id are KEPT as-is and now
-- represent the "lead" technician on the job — this is what every
-- existing single-name display, capacity check, and dispatch email
-- already reads, so nothing downstream breaks. Every technician on the
-- job (including the lead) also gets a row here, so real team-based
-- workload counts and multi-recipient dispatch emails are possible.
-- ============================================================
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

-- Back-fill: every existing job order's single assigned_staff_id becomes
-- that ticket's lead row, so team-based workload counts stay correct the
-- moment this migration runs — no ticket silently drops to a 0-person team.
INSERT INTO job_order_staff (job_order_id, staff_id, is_lead, match_score)
SELECT id, assigned_staff_id, TRUE, match_score
FROM job_orders
WHERE assigned_staff_id IS NOT NULL
ON CONFLICT (job_order_id, staff_id) DO NOTHING;


-- ============================================================
-- 7. LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS logs (
    id         SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message    TEXT,
    ticket_id  TEXT REFERENCES job_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_logs_ticket_id ON logs(ticket_id);


-- ============================================================
-- 8. NOTIFICATIONS
-- Text PK because app generates IDs like "n_<epoch>_<role>"
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message     TEXT,
    role        VARCHAR(20),
    ticket_id   TEXT REFERENCES job_orders(id) ON DELETE CASCADE
);

-- For deployments where `notifications` already existed before this column
-- was added (CREATE TABLE IF NOT EXISTS above won't retrofit it).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ticket_id TEXT REFERENCES job_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);


-- ============================================================
-- 9. EXTERNAL PROVIDERS (for outsourced repairs)
-- ============================================================
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


-- ============================================================
-- 10. BUDGET ALLOCATIONS (per department per fiscal year)
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_allocations (
    id               SERIAL PRIMARY KEY,
    department_id    INT  NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    fiscal_year      INT  NOT NULL,
    allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    spent_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency         CHAR(3)       NOT NULL DEFAULT 'PHP',
    UNIQUE (department_id, fiscal_year)
);


-- ============================================================
-- 11. APPROVAL AUDIT LOG
-- Every PPO / President / Finance action is recorded here.
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_audit_log (
    id             SERIAL PRIMARY KEY,
    job_order_id   TEXT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    actor_user_id  INT  REFERENCES users(id),
    action         VARCHAR(50) NOT NULL,  -- e.g. 'PPO_APPROVE','PRESIDENT_ENDORSE','FINANCE_RELEASE','EMERGENCY_OVERRIDE'
    previous_value TEXT,
    new_value      TEXT,
    reason         TEXT,
    amount_php     NUMERIC(12,2),         -- amount in Philippine Pesos, if applicable
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_job_order_id ON approval_audit_log(job_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON approval_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON approval_audit_log(action);

-- For deployments where `approval_audit_log` already existed before this
-- column was added (CREATE TABLE IF NOT EXISTS above won't retrofit it).
ALTER TABLE approval_audit_log ADD COLUMN IF NOT EXISTS amount_php NUMERIC(12,2);

-- ============================================================
-- END OF SCHEMA
-- ============================================================