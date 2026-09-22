-- ==============================================================================
-- Migration: 20260921000002_enable_rls_policies.sql
-- Description: Enable Row Level Security (RLS) and grant full access to authenticated users
-- Rule: Authenticated users can read and write; anonymous users have no access.
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for authenticated users

-- Academic Years
CREATE POLICY "Allow authenticated users full access to academic_years"
    ON academic_years
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Courses
CREATE POLICY "Allow authenticated users full access to courses"
    ON courses
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Lecturers
CREATE POLICY "Allow authenticated users full access to lecturers"
    ON lecturers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Rooms
CREATE POLICY "Allow authenticated users full access to rooms"
    ON rooms
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Sessions
CREATE POLICY "Allow authenticated users full access to sessions"
    ON sessions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Schedules
CREATE POLICY "Allow authenticated users full access to schedules"
    ON schedules
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Schedule Lecturers
CREATE POLICY "Allow authenticated users full access to schedule_lecturers"
    ON schedule_lecturers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Settings
CREATE POLICY "Allow authenticated users full access to settings"
    ON settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
