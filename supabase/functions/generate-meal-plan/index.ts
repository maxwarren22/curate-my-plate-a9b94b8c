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