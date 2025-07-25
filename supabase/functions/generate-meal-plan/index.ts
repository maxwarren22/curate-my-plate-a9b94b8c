import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// --- START: UTILITIES ---
// Moved from _shared/utils.ts to resolve import error

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function log(level: "INFO" | "ERROR", message: string, data: Record<string, unknown> = {}) {
    console.log(JSON.stringify({
        level,
        message,
        ...data,
        timestamp: new Date().toISOString()
    }));
}

// --- END: UTILITIES ---


// --- START: TYPE DEFINITIONS ---

interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  recipe: string;
  calories: number;
  created_by_user: string;
}

interface MealDay {
  day: string;
  main_dish: Recipe;
  side_dish?: Recipe | null;
  total_time_to_cook: string;
  cooking_tips?: string;
}

interface MealPlanResponse {
  days: MealDay[];
  shopping_list: { category: string; items: string[] }[];
}

interface MealPlanRequest {
  userId: string;
  pantryItems: string[];
  dietaryPreferences: string;
  cookTime: string;
}

interface MealHistoryDay {
    day: string;
    main_dish_id: string;
    side_dish_id: string | null;
    total_time_to_cook: string;
    cooking_tips?: string;
}

// --- END: TYPE DEFINITIONS ---

async function generateMealPlan(pantryItems: string[], dietaryPreferences: string, cookTime: string): Promise<MealDay[]> {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  const prompt = `
    Generate a 7-day meal plan based on the following criteria:
    - Pantry items available: ${pantryItems.join(", ")}
    - Dietary preferences: ${dietaryPreferences}
    - Maximum cooking time per meal: ${cookTime}
    
    For each day, provide a main dish, an optional side dish, the total cooking time, and helpful cooking tips for the day's meal.
    For each dish, include a title, a brief description, a list of ingredients, a step-by-step recipe, and approximate calories.
    Ensure the response contains a complete 7-day plan.

    Return the response as a valid JSON object in the following structure: 
    {
      "days": [
        {
          "day": "Monday",
          "main_dish": {"title": "...", "description": "...", "ingredients": ["..."], "recipe": "...", "calories": 0},
          "side_dish": {"title": "...", "description": "...", "ingredients": ["..."], "recipe": "...", "calories": 0},
          "total_time_to_cook": "...",
          "cooking_tips": "..."
        }
      ]
    }
  `;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log("ERROR", "OpenAI API request failed.", { status: response.status, body: errorBody });
    throw new Error("Failed to fetch meal plan from OpenAI.");
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content;
  log("INFO", "Received raw content from OpenAI.", { rawContent });

  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in the response from OpenAI.");
    }
    
    const mealPlan = JSON.parse(jsonMatch[0]);
    return mealPlan.days;
  } catch (error) {
    log("ERROR", "Failed to parse meal plan from OpenAI.", { error: error.message, content: rawContent });
    throw new Error("Failed to parse meal plan from OpenAI.");
  }
}

async function saveOrGetRecipe(supabaseClient: SupabaseClient, dish: Recipe, userId: string): Promise<string> {
    if (!dish || !dish.title) {
        log("ERROR", "Invalid dish object provided. Skipping.", { dish });
        return '00000000-0000-0000-0000-000000000000';
    }

    const { data: existingRecipe, error: selectError } = await supabaseClient
        .from('recipes')
        .select('id')
        .eq('title', dish.title)
        .maybeSingle();
    
    if (selectError) {
        log("ERROR", "Error checking for existing recipe.", { error: selectError });
        throw selectError;
    }

    if (existingRecipe) {
        return existingRecipe.id;
    }

    const { data: newRecipe, error: insertError } = await supabaseClient
        .from('recipes')
        .insert({
            title: dish.title,
            description: dish.description,
            ingredients: dish.ingredients.join('\n'),
            recipe: dish.recipe,
            calories: dish.calories,
            created_by_user: userId,
        })
        .select('id')
        .single();
        
    if (insertError) {
        log("ERROR", "Failed to insert new recipe.", { error: insertError });
        throw insertError;
    }
    if (!newRecipe) {
        throw new Error("Failed to create new recipe and retrieve its ID.");
    }
  
    return newRecipe.id;
}

async function generateShoppingListWithAI(mealPlan: MealDay[], supabaseClient: SupabaseClient, userId: string): Promise<void> {
    log("INFO", "Starting shopping list generation...");
    
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
        log("ERROR", "OpenAI API key not configured for shopping list generation - using fallback");
        await generateFallbackShoppingList(mealPlan, supabaseClient, userId);
        return;
    }

    // Collect all ingredients from meal plan
    const allIngredients: string[] = [];
    mealPlan.forEach(day => {
        // Handle main dish ingredients
        if (day.main_dish?.ingredients) {
            if (Array.isArray(day.main_dish.ingredients)) {
                allIngredients.push(...day.main_dish.ingredients);
            } else {
                allIngredients.push(day.main_dish.ingredients);
            }
        }
        // Handle side dish ingredients
        if (day.side_dish?.ingredients) {
            if (Array.isArray(day.side_dish.ingredients)) {
                allIngredients.push(...day.side_dish.ingredients);
            } else {
                allIngredients.push(day.side_dish.ingredients);
            }
        }
    });

    if (allIngredients.length === 0) {
        log("ERROR", "No ingredients found in meal plan");
        return;
    }

    log("INFO", "All ingredients for shopping list:", { allIngredients, count: allIngredients.length });

    const prompt = `You are a smart shopping list assistant. Please process this list of ingredients from a weekly meal plan and create a clean, aggregated shopping list.

Ingredients from recipes:
${allIngredients.join('\n')}

Please:
1. Parse and normalize all ingredients
2. Aggregate quantities of the same items (e.g., "2 avocados" + "3 avocado" = "5 avocados")
3. Use proper plural/singular forms
4. Make vague items more specific (e.g., "1 cheese" → "8 oz cheddar cheese")
5. Convert weird formats to common vernacular (e.g., "Juice of 1 Lemon" → "1 lemon (for juice)")
6. Categorize into: Produce, Meat & Seafood, Dairy & Eggs, Grains & Bakery, Pantry Staples, Canned/Packaged, Other
7. Estimate realistic grocery store prices in USD

Return a JSON object in this exact format:
{
  "ingredients": [
    {
      "name": "avocados",
      "quantity": "5",
      "category": "Produce", 
      "estimatedPrice": 7.50
    }
  ],
  "totalEstimatedCost": 85.25
}

Make sure quantities are reasonable, names are clear, and prices reflect typical US grocery store costs.`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a helpful grocery shopping assistant that creates clean, organized shopping lists.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(content);
        } catch (e) {
            log("ERROR", "Failed to parse OpenAI shopping list response", { content });
            throw new Error('Invalid response format from OpenAI');
        }

        // Categorize ingredients for storage
        const categorizedList: Record<string, any[]> = {};
        parsedResult.ingredients.forEach((ingredient: any) => {
            if (!categorizedList[ingredient.category]) {
                categorizedList[ingredient.category] = [];
            }
            categorizedList[ingredient.category].push({
                name: ingredient.name,
                quantity: ingredient.quantity,
                estimatedPrice: ingredient.estimatedPrice
            });
        });

        // Save to shopping_lists table
        const weekStartDate = new Date().toISOString().split('T')[0];
        const shoppingListData = {
            user_id: userId,
            week_start_date: weekStartDate,
            shopping_list: Object.entries(categorizedList).map(([category, items]) => ({
                category,
                items: items.map(item => `${item.quantity} ${item.name}`)
            })),
            budget: `$${Math.round(parsedResult.totalEstimatedCost)}`,
            ai_processed_ingredients: parsedResult.ingredients
        };

        // Delete old shopping list for this week
        await supabaseClient
            .from('shopping_lists')
            .delete()
            .eq('user_id', userId)
            .eq('week_start_date', weekStartDate);

        // Insert new shopping list
        const { error: insertError } = await supabaseClient
            .from('shopping_lists')
            .insert(shoppingListData);

        if (insertError) {
            log("ERROR", "Failed to save shopping list", { error: insertError });
            throw insertError;
        }

        log("INFO", "Shopping list saved successfully", { userId, totalCost: parsedResult.totalEstimatedCost });

    } catch (error) {
        log("ERROR", "Error generating shopping list with AI", { error });
        throw error;
    }
}

async function generateFallbackShoppingList(mealPlan: MealDay[], supabaseClient: SupabaseClient, userId: string): Promise<void> {
    log("INFO", "Generating fallback shopping list...");
    
    // Collect all ingredients from meal plan
    const allIngredients: string[] = [];
    mealPlan.forEach(day => {
        if (day.main_dish?.ingredients) {
            if (Array.isArray(day.main_dish.ingredients)) {
                allIngredients.push(...day.main_dish.ingredients);
            } else {
                allIngredients.push(day.main_dish.ingredients);
            }
        }
        if (day.side_dish?.ingredients) {
            if (Array.isArray(day.side_dish.ingredients)) {
                allIngredients.push(...day.side_dish.ingredients);
            } else {
                allIngredients.push(day.side_dish.ingredients);
            }
        }
    });

    // Basic categorization function
    const categorizeIngredient = (name: string): string => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('fish') || lowerName.includes('salmon') || lowerName.includes('shrimp')) {
            return 'Meat & Seafood';
        }
        if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('yogurt') || lowerName.includes('egg')) {
            return 'Dairy & Eggs';
        }
        if (lowerName.includes('tomato') || lowerName.includes('onion') || lowerName.includes('avocado') || lowerName.includes('garlic') || lowerName.includes('cucumber') || lowerName.includes('lettuce') || lowerName.includes('fruits') || lowerName.includes('lemon') || lowerName.includes('lime')) {
            return 'Produce';
        }
        if (lowerName.includes('bread') || lowerName.includes('pasta') || lowerName.includes('rice') || lowerName.includes('tortilla')) {
            return 'Grains & Bakery';
        }
        if (lowerName.includes('oil') || lowerName.includes('salt') || lowerName.includes('pepper') || lowerName.includes('seasoning')) {
            return 'Pantry Staples';
        }
        return 'Other';
    };

    // Process ingredients into shopping list format
    const processedIngredients: any[] = [];
    const seenIngredients = new Set<string>();
    let totalCost = 0;

    allIngredients.forEach(ingredient => {
        const cleanIngredient = ingredient.trim().toLowerCase();
        if (!cleanIngredient || seenIngredients.has(cleanIngredient)) return;
        
        seenIngredients.add(cleanIngredient);
        const category = categorizeIngredient(cleanIngredient);
        const estimatedPrice = 2.50; // Basic price estimate
        
        processedIngredients.push({
            name: ingredient.trim(),
            quantity: "1",
            category,
            estimatedPrice
        });
        
        totalCost += estimatedPrice;
    });

    // Group by category for storage
    const categorizedList: Record<string, any[]> = {};
    processedIngredients.forEach(ingredient => {
        if (!categorizedList[ingredient.category]) {
            categorizedList[ingredient.category] = [];
        }
        categorizedList[ingredient.category].push({
            name: ingredient.name,
            quantity: ingredient.quantity,
            estimatedPrice: ingredient.estimatedPrice
        });
    });

    // Save to shopping_lists table
    const weekStartDate = new Date().toISOString().split('T')[0];
    const shoppingListData = {
        user_id: userId,
        week_start_date: weekStartDate,
        shopping_list: Object.entries(categorizedList).map(([category, items]) => ({
            category,
            items: items.map(item => `${item.quantity} ${item.name}`)
        })),
        budget: `$${Math.round(totalCost)}`,
        ai_processed_ingredients: processedIngredients
    };

    // Delete old shopping list for this week
    await supabaseClient
        .from('shopping_lists')
        .delete()
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate);

    // Insert new shopping list
    const { error: insertError } = await supabaseClient
        .from('shopping_lists')
        .insert(shoppingListData);

    if (insertError) {
        log("ERROR", "Failed to save fallback shopping list", { error: insertError });
        throw insertError;
    }

    log("INFO", "Fallback shopping list saved successfully", { userId, totalCost, ingredientCount: processedIngredients.length });
}


serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId, pantryItems, dietaryPreferences, cookTime }: MealPlanRequest = await req.json();
        
        const supabaseClient: SupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const mealPlan = await generateMealPlan(pantryItems, dietaryPreferences, cookTime);
        log("INFO", "Generated meal plan from OpenAI.", { userId });

        const mealDaysWithRecipeIds: MealHistoryDay[] = await Promise.all(
            mealPlan.map(async (dayPlan) => {
                const mainDishId = await saveOrGetRecipe(supabaseClient, dayPlan.main_dish, userId);
                
                let sideDishId: string | null = null;
                if (dayPlan.side_dish) {
                    sideDishId = await saveOrGetRecipe(supabaseClient, dayPlan.side_dish, userId);
                }

                return {
                    day: dayPlan.day,
                    main_dish_id: mainDishId,
                    side_dish_id: sideDishId,
                    total_time_to_cook: dayPlan.total_time_to_cook,
                    cooking_tips: dayPlan.cooking_tips,
                };
            })
        );
        
        const { error: decrementError } = await supabaseClient.rpc(
            'decrement_generations', 
            { user_id_param: userId }
        );

        if (decrementError) {
            log("ERROR", "Failed to decrement generation count.", { error: decrementError });
            // Decide if this should be a hard error or just a warning
            // For now, we'll log it and continue
        }

        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        const { error: deleteError } = await supabaseClient
            .from('user_meal_history')
            .delete()
            .eq('user_id', userId)
            .gte('meal_date', today.toISOString().split('T')[0])
            .lte('meal_date', nextWeek.toISOString().split('T')[0]);

        if (deleteError) {
            log("ERROR", "Failed to delete old meal plan.", { error: deleteError });
            throw deleteError;
        }
        
        const historyRecords = mealDaysWithRecipeIds.map((day, index) => {
            const mealDate = new Date();
            mealDate.setDate(mealDate.getDate() + index);
            return {
                user_id: userId,
                main_dish_recipe_id: day.main_dish_id,
                side_dish_recipe_id: day.side_dish_id,
                meal_date: mealDate.toISOString().split('T')[0],
                total_time_to_cook: day.total_time_to_cook,
                cooking_tips: day.cooking_tips,
            };
        });

        const { error: historyError } = await supabaseClient
            .from('user_meal_history')
            .insert(historyRecords);

        if (historyError) {
            log("ERROR", "Failed to insert into user_meal_history.", { error: historyError });
            throw historyError;
        }

        log("INFO", "Successfully saved meal plan to user history.", { userId });

        // Generate and save shopping list with AI processing
        log("INFO", "Generating shopping list with AI processing...");
        log("INFO", "Meal plan for shopping list:", { mealPlanLength: mealPlan.length, firstDay: mealPlan[0] });
        try {
            await generateShoppingListWithAI(mealPlan, supabaseClient, userId);
            log("INFO", "Shopping list generated and saved successfully");
        } catch (error) {
            log("ERROR", "Failed to generate shopping list, but meal plan saved", { error: error.message, stack: error.stack });
            // Don't fail the entire operation if shopping list generation fails
        }

        return new Response(
            JSON.stringify({ mealPlan }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

    } catch (error) {
        if (error instanceof SyntaxError && error.message.includes("Unexpected end of JSON input")) {
            log("ERROR", "Failed to parse request body.", { error: error.message });
            return new Response(JSON.stringify({ error: "Request body is empty or invalid." }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        let errorMessage = "An unknown error occurred.";
        if (error instanceof Error) {
            errorMessage = error.message;
            log("ERROR", "Top-level function error.", { error: errorMessage, stack: error.stack });
        } else {
            log("ERROR", "Top-level function error.", { error: String(error) });
        }
        
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});