-- Step 1: Add the 'servings' column to the recipes table if it's missing
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS servings INTEGER;

-- Step 2: Drop the old user_meal_history table to redefine it completely
DROP TABLE IF EXISTS public.user_meal_history;

-- Step 3: Recreate the user_meal_history table with the correct structure
CREATE TABLE public.user_meal_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    main_dish_recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    side_dish_recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    total_time_to_cook TEXT,
    cooking_tips TEXT,
    rating INTEGER, -- You may want to move this to a separate ratings table later
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, meal_date)
);

-- Step 4: Re-apply Row Level Security and Indexes
ALTER TABLE public.user_meal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own meal history"
ON public.user_meal_history FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX idx_user_meal_history_user_date ON public.user_meal_history(user_id, meal_date);