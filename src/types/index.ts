// This file will hold all shared type definitions for your application.

export interface Meal {
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
  servings?: number; // Servings are optional for side dishes
}

export interface MealDay {
  day: string;
  main_dish: Meal;
  side_dish: Omit<Meal, 'servings'>; // A side dish is a meal without a 'servings' property
  total_time_to_cook: string;
  cooking_tips?: string;
}