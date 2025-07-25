-- Add column to store AI-processed ingredients with detailed information
ALTER TABLE public.shopping_lists 
ADD COLUMN ai_processed_ingredients jsonb;