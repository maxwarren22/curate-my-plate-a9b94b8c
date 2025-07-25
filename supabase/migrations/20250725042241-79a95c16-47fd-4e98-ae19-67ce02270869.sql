-- Add Spoonacular-specific fields to recipes table
ALTER TABLE public.recipes 
ADD COLUMN spoonacular_id integer,
ADD COLUMN image_url text,
ADD COLUMN source_url text,
ADD COLUMN prep_time integer,
ADD COLUMN cook_time integer,
ADD COLUMN ready_in_minutes integer,
ADD COLUMN health_score integer,
ADD COLUMN price_per_serving numeric,
ADD COLUMN nutrition jsonb,
ADD COLUMN source_type text DEFAULT 'ai' CHECK (source_type IN ('ai', 'spoonacular'));

-- Add index for faster Spoonacular lookups
CREATE INDEX idx_recipes_spoonacular_id ON public.recipes(spoonacular_id);
CREATE INDEX idx_recipes_source_type ON public.recipes(source_type);