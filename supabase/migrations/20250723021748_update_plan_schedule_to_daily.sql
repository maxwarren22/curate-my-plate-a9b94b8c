-- First, remove the old weekly job to avoid duplicates
select cron.unschedule('weekly-plan-email');

-- Now, schedule the new daily job
select
  cron.schedule(
    'daily-plan-sender',    -- New name for the job
    '0 5 * * *',            -- Runs every day at 5:00 AM UTC
    $$
      select public.invoke_send_weekly_plan();
    $$
  );

  -- Increase memory for the current session to build the index
SET maintenance_work_mem = '128MB';

-- Step 4: Create an index for faster similarity searches, if it doesn't exist
CREATE INDEX IF NOT EXISTS recipes_embedding_ivfflat_idx ON public.recipes USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Reset the memory setting back to the default
RESET maintenance_work_mem;