-- Step 1: Enable the pgvector extension for vector support
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the recipes table with an embedding column
CREATE TABLE public.recipes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    recipe TEXT NOT NULL,
    calories INTEGER,
    servings INTEGER,
    total_time_to_cook TEXT,
    cooking_tips TEXT,
    created_by_user UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    embedding vector(1536) -- Embedding column added here
);

-- Step 3: Create user_meal_history table
CREATE TABLE public.user_meal_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    recipe_id UUID REFERENCES public.recipes(id) NOT NULL,
    side_dish_recipe_id UUID REFERENCES public.recipes(id),
    meal_date DATE NOT NULL,
    meal_type TEXT DEFAULT 'dinner',
    rating INTEGER DEFAULT 0,
    user_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 4: Add Row Level Security (RLS) policies
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view recipes" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Users can create recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = created_by_user);

ALTER TABLE public.user_meal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal history" ON public.user_meal_history FOR ALL
    USING (auth.uid() = user_id);

-- Step 5: Create standard indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_meal_history_user_date ON public.user_meal_history(user_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_user_meal_history_rating ON public.user_meal_history(user_id, rating);

-- Step 6: Create the vector index with appropriate memory settings
-- Increase memory for the current session to build the index
SET maintenance_work_mem = '128MB';

-- Create the IVFFlat index for faster similarity searches
CREATE INDEX IF NOT EXISTS recipes_embedding_ivfflat_idx ON public.recipes USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Reset the memory setting back to the default
RESET maintenance_work_mem;
