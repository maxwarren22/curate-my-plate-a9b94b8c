// src/lib/ingredient-utils.ts
import { parseIngredient } from "parse-ingredient";
import type { Recipe, PantryItem } from "@/types";

interface AggregatedIngredient {
  quantity: number | null;
  unitOfMeasure: string | null;
  description: string;
}

const toSingular = (word: string): string => {
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 2 && word.toLowerCase() !== 'hummus') return word.slice(0, -1);
  return word;
};

export const generateShoppingListFromRecipes = (recipes: Recipe[], pantryItems: PantryItem[]): Record<string, string[]> => {
    // This is a placeholder for a function that can categorize ingredients.
    // For now, it will return a single "Miscellaneous" category.
    const categorizeIngredient = (ingredient: string) => "Miscellaneous";

    if (!recipes || recipes.length === 0) {
        return {};
    }

    const allIngredientStrings = recipes
        .flatMap(recipe => recipe.ingredients?.split('\n') || [])
        .filter(s => s && s.trim() !== '');

    const parsedIngredients = allIngredientStrings.flatMap(ing => parseIngredient(ing.replace(/-\s*/, '')));

    const requiredMap = new Map<string, AggregatedIngredient>();

    parsedIngredients.forEach(p => {
        if (!p.description) return;

        const description = p.description.split(',')[0].trim().toLowerCase();
        const singularDescription = toSingular(description);
        const unit = p.unitOfMeasure?.toLowerCase() || '';
        const key = `${singularDescription}|${unit}`;

        const existing = requiredMap.get(key);
        if (existing) {
            existing.quantity = (existing.quantity || 0) + (p.quantity || 1);
        } else {
            requiredMap.set(key, {
                quantity: p.quantity || 1,
                unitOfMeasure: p.unitOfMeasure || '',
                description: singularDescription,
            });
        }
    });

    const pantryMap = new Map<string, AggregatedIngredient>();
    pantryItems.forEach(item => {
        const parsedPantryItemArray = parseIngredient(`${item.quantity || ''} ${item.ingredient_name}`);
        if (parsedPantryItemArray.length > 0) {
            const parsedPantryItem = parsedPantryItemArray[0];
            if (parsedPantryItem && parsedPantryItem.description) {
                const description = parsedPantryItem.description.split(',')[0].trim().toLowerCase();
                const singularDescription = toSingular(description);
                const unit = parsedPantryItem.unitOfMeasure?.toLowerCase() || '';
                const key = `${singularDescription}|${unit}`;
                pantryMap.set(key, {
                    quantity: parsedPantryItem.quantity || 1,
                    unitOfMeasure: parsedPantryItem.unitOfMeasure || '',
                    description: singularDescription
                });
            }
        }
    });

    const shoppingList: Record<string, string[]> = {};

    for (const [key, required] of requiredMap.entries()) {
        const pantryItem = pantryMap.get(key);
        let neededQuantity = required.quantity;

        if (pantryItem && pantryItem.quantity && required.quantity) {
            if (pantryItem.unitOfMeasure?.toLowerCase() === required.unitOfMeasure?.toLowerCase()) {
                 neededQuantity = required.quantity - pantryItem.quantity;
            }
        } else if (pantryItem) {
            // If pantry item exists but no quantity, assume we have enough
            neededQuantity = 0;
        }

        if (neededQuantity && neededQuantity > 0) {
            const category = categorizeIngredient(required.description);
            if (!shoppingList[category]) {
                shoppingList[category] = [];
            }
            shoppingList[category].push(`${neededQuantity} ${required.unitOfMeasure || ''} ${required.description}`.trim().replace(/\s+/g, ' '));
        } else if (!pantryItem) {
            const category = categorizeIngredient(required.description);
            if (!shoppingList[category]) {
                shoppingList[category] = [];
            }
            shoppingList[category].push(`${required.quantity || ''} ${required.unitOfMeasure || ''} ${required.description}`.trim().replace(/\s+/g, ' '));
        }
    }

    return shoppingList;
};
