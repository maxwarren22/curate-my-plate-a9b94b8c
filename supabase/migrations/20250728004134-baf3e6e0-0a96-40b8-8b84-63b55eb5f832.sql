-- Add unique constraint on spoonacular_id to fix upsert conflicts
ALTER TABLE recipes ADD CONSTRAINT recipes_spoonacular_id_unique UNIQUE (spoonacular_id);