-- Supabase Database Setup for PDF Toolkit Pro
-- Run these commands in your Supabase SQL Editor

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  files_uploaded INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create file_uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  operation TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for user_stats
CREATE POLICY "Users can view their own stats" ON user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" ON user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for file_uploads
CREATE POLICY "Users can view their own uploads" ON file_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads" ON file_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_at ON file_uploads(uploaded_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_stats
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create global_metrics table for real-time KPI counters
CREATE TABLE IF NOT EXISTS global_metrics (
  id SERIAL PRIMARY KEY,
  total_files BIGINT DEFAULT 0,
  uploaded_today INTEGER DEFAULT 0,
  processed_today INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_time FLOAT DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  today_date DATE DEFAULT CURRENT_DATE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE global_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for global_metrics (read-only for all authenticated users, update via functions)
CREATE POLICY "Authenticated users can read global metrics" ON global_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert initial row
INSERT INTO global_metrics (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Function to update metrics safely
CREATE OR REPLACE FUNCTION update_global_metrics(
  p_total_files_diff INTEGER DEFAULT 0,
  p_uploaded_today_diff INTEGER DEFAULT 0,
  p_processed_today_diff INTEGER DEFAULT 0,
  p_error_count_diff INTEGER DEFAULT 0,
  p_avg_time_new FLOAT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  current_rec RECORD;
BEGIN
  -- Check if today has changed, reset daily counters if so
  SELECT * INTO current_rec FROM global_metrics WHERE id = 1 FOR UPDATE;

  IF current_rec.today_date != CURRENT_DATE THEN
    UPDATE global_metrics SET
      uploaded_today = 0,
      processed_today = 0,
      error_count = 0,
      today_date = CURRENT_DATE,
      last_updated = NOW()
    WHERE id = 1;
  END IF;

  -- Update metrics
  UPDATE global_metrics SET
    total_files = GREATEST(0, total_files + COALESCE(p_total_files_diff, 0)),
    uploaded_today = GREATEST(0, uploaded_today + COALESCE(p_uploaded_today_diff, 0)),
    processed_today = GREATEST(0, processed_today + COALESCE(p_processed_today_diff, 0)),
    error_count = GREATEST(0, error_count + COALESCE(p_error_count_diff, 0)),
    avg_time = COALESCE(p_avg_time_new, avg_time),
    total_users = (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    last_updated = NOW()
  WHERE id = 1;

  -- Log the update for debugging
  RAISE LOG 'Global metrics updated: total_files=%d, uploaded_today=%d, processed_today=%d, error_count=%d, avg_time=%f',
    p_total_files_diff, p_uploaded_today_diff, p_processed_today_diff, p_error_count_diff, p_avg_time_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
