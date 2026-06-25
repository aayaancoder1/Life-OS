-- Categories Enum
CREATE TYPE item_category AS ENUM (
  'opportunity', 'project', 'academic', 'career', 'personal', 'idea', 'knowledge'
);

-- Status Enum
CREATE TYPE item_status AS ENUM (
  'backlog', 'parking_lot', 'in_progress', 'completed', 'archived'
);

-- Capture Table (Ingested Raw Data)
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'telegram', 'manual', etc.
  raw_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Item Table (Core Entity)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID REFERENCES captures(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  category item_category NOT NULL,
  status item_status DEFAULT 'backlog',
  importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 10),
  metadata JSONB DEFAULT '{}'::jsonb, -- Store category-specific fields here
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deadline Table
CREATE TABLE deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  deadline_at TIMESTAMP WITH TIME ZONE NOT NULL,
  calendar_event_id VARCHAR(255), -- ID returned by Google Calendar
  sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'synced', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Log Table (For future Review engine / Chief of staff)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'deadline_updated'
  old_state JSONB,
  new_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stored function to atomically claim pending captures using row locking
CREATE OR REPLACE FUNCTION claim_pending_captures(limit_count INT)
RETURNS SETOF captures AS $$
BEGIN
  RETURN QUERY
  WITH selected AS (
    SELECT id
    FROM captures
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT limit_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE captures c
  SET status = 'processing'
  FROM selected s
  WHERE c.id = s.id
  RETURNING c.*;
END;
$$ LANGUAGE plpgsql;

