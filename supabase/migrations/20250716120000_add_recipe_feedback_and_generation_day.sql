-- Add table for liked recipes
CREATE TABLE liked_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Add table for disliked recipes
CREATE TABLE disliked_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Add column to profiles table for meal plan generation day
ALTER TABLE profiles
ADD COLUMN plan_generation_day TEXT DEFAULT 'Sunday';

-- Add policy for liked_recipes
ALTER TABLE liked_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own liked recipes"
ON liked_recipes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add policy for disliked_recipes
ALTER TABLE disliked_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own disliked recipes"
ON disliked_recipes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
