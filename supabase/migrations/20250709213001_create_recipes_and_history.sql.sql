-- Create recipes table to store unique recipes
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_meal_history table to track meals and preferences
CREATE TABLE public.user_meal_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    recipe_id UUID REFERENCES public.recipes(id) NOT NULL,
    side_dish_recipe_id UUID REFERENCES public.recipes(id),
    meal_date DATE NOT NULL,
    meal_type TEXT DEFAULT 'dinner',
    rating INTEGER DEFAULT 0, -- -1 for dislike, 0 for neutral, 1 for like
    user_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies for recipes table
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view recipes" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Users can create recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = created_by_user);

-- RLS policies for user_meal_history table
ALTER TABLE public.user_meal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal history" ON public.user_meal_history FOR ALL
    USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_user_meal_history_user_date ON public.user_meal_history(user_id, meal_date);
CREATE INDEX idx_user_meal_history_rating ON public.user_meal_history(user_id, rating);
CREATE INDEX idx_recipes_title ON public.recipes(title);
