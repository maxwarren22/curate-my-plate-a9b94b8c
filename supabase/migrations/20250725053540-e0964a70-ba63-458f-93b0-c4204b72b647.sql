-- Create a table to cache recipe pools based on user preferences
CREATE TABLE public.recipe_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preference_hash TEXT NOT NULL UNIQUE,
  dietary_restrictions TEXT[] DEFAULT ARRAY[]::TEXT[],
  cuisine_preferences TEXT[] DEFAULT ARRAY[]::TEXT[],
  recipes JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '14 days')
);

-- Enable RLS
ALTER TABLE public.recipe_pools ENABLE ROW LEVEL SECURITY;

-- Create policy for recipe pools (public read access since pools are shared)
CREATE POLICY "Anyone can view recipe pools" 
ON public.recipe_pools 
FOR SELECT 
USING (true);

-- Create policy for inserting recipe pools
CREATE POLICY "System can insert recipe pools" 
ON public.recipe_pools 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_recipe_pools_preference_hash ON public.recipe_pools(preference_hash);
CREATE INDEX idx_recipe_pools_expires_at ON public.recipe_pools(expires_at);

-- Create function to clean up expired pools
CREATE OR REPLACE FUNCTION public.cleanup_expired_recipe_pools()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.recipe_pools 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;