-- Create user_recipe_pools table for caching user-specific scored recipes
CREATE TABLE public.user_recipe_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_pool_id UUID NOT NULL REFERENCES public.recipe_pools(id),
  user_pool_hash TEXT NOT NULL UNIQUE,
  scored_recipes JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_recipe_pools ENABLE ROW LEVEL SECURITY;

-- Create policies for user recipe pools
CREATE POLICY "Users can view their own recipe pools" 
ON public.user_recipe_pools 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage user recipe pools" 
ON public.user_recipe_pools 
FOR ALL 
USING (true);

-- Create index for efficient lookups
CREATE INDEX idx_user_recipe_pools_hash ON public.user_recipe_pools(user_pool_hash);
CREATE INDEX idx_user_recipe_pools_expires ON public.user_recipe_pools(expires_at);

-- Update recipe_pools table to extend expiration to 1 month
ALTER TABLE public.recipe_pools ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '1 month');