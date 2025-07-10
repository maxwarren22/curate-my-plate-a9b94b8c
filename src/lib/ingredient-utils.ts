import { parseIngredient } from "parse-ingredient";
import type { Recipe } from "@/types";

// This interface is a simplified version of what's in your DB
interface PantryItem {
  ingredient_name: string;
}

interface AggregatedIngredient {
  quantity: number;
  unitOfMeasure: string;
  description: string;
}

// A simple function to handle common plurals (e.g., "carrots" -> "carrot")
const toSingular = (word: string): string => {
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 2 && word !== 'hummus') return word.slice(0, -1);
  return word;
};

export const generateShoppingList = (recipes: Recipe[], pantryItems: PantryItem[]): string => {
  if (!recipes || recipes.length === 0) {
    return "";
  }
  
  const allIngredientStrings = recipes
    .flatMap(recipe => recipe.ingredients?.split('\n') || [])
    .filter(s => s && s.trim() !== '');

  const parsedIngredients = allIngredientStrings.flatMap(ing => parseIngredient(ing.replace(/-\s*/, '')));
  
  const requiredMap = new Map<string, AggregatedIngredient>();
  
  parsedIngredients.forEach(p => {
    if (!p.description) return;

    // Normalize the ingredient name to handle variations like "sliced" or "diced"
    const description = p.description.split(',')[0].trim().toLowerCase();
    const singularDescription = toSingular(description);
    const unit = p.unitOfMeasure?.toLowerCase() || '';

    // Use a composite key of the ingredient name and its unit for aggregation
    const key = `${singularDescription}|${unit}`;
    
    const existing = requiredMap.get(key);
    if (existing) {
      existing.quantity += p.quantity || 1; // Default to 1 if quantity is missing
    } else {
      requiredMap.set(key, {
        quantity: p.quantity || 1,
        unitOfMeasure: p.unitOfMeasure || '',
        description: singularDescription,
      });
    }
  });

  const pantrySet = new Set(pantryItems.map(item => toSingular(item.ingredient_name.toLowerCase())));

  const shoppingListItems = Array.from(requiredMap.values())
    .filter(item => !pantrySet.has(item.description)) // Subtract pantry items
    .map(p => `${p.quantity || ''} ${p.unitOfMeasure || ''} ${p.description}`.trim().replace(/\s+/g, ' '));

  return shoppingListItems.join('\n');
};
