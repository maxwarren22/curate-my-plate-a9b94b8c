// src/types/index.ts

// This represents a single recipe from your 'recipes' table
export interface Recipe {
  id: string;
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
  servings?: number;
  total_time_to_cook?: string;
  cooking_tips?: string;
}

// This represents the combined meal for a single day,
// which is what your UI components will use.
export interface MealDay {
  day: string;
  main_dish: Recipe;
  side_dish?: Recipe; // Make side dish optional and keep full Recipe type
  total_time_to_cook: string;
  cooking_tips?: string;
}

export interface PantryItem {
  id: string;
  ingredient_name: string;
  quantity?: string;
  expiry_date?: string;
}