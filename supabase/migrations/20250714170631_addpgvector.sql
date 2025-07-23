-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add an 'embedding' column to the recipes table
-- Step 2: Add an 'embedding' column to the recipes table
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS embedding vector(1536); -- 1536 is the dimension for OpenAI's text-embedding-ada-002

-- Step 3: Create a function to find similar recipes
CREATE OR REPLACE FUNCTION match_recipe (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    r.id,
    r.title,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.recipes AS r
  WHERE 1 - (r.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Step 4: Create an index for faster similarity searches
CREATE INDEX ON public.recipes USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);