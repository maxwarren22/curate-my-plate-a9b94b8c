// This file will hold all shared type definitions for your application.

export interface Recipe {
  id: string;
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
}

export interface MealDay {
  day: string;
  main_dish: Recipe;
  side_dish: Recipe;
  total_time_to_cook: string;
  cooking_tips?: string;
}