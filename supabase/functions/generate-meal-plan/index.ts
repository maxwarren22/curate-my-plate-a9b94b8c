import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Dish {
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
  servings?: number;
}

const log = (level: "INFO" | "ERROR", step: string, details: unknown = {}) => {
  console.log(`[${level}] [generate-meal-plan] ${step}`, JSON.stringify(details));
};

async function saveOrGetRecipe(supabaseClient: SupabaseClient, dish: Dish, userId: string): Promise<string> {
  const { data: existingRecipe, error: searchError } = await supabaseClient
    .from('recipes')
    .select('id')
    .eq('title', dish.title)
    .maybeSingle();

  if (searchError) throw searchError;
  if (existingRecipe) return existingRecipe.id;

  const { data: newRecipe, error: insertError } = await supabaseClient
    .from('recipes')
    .insert({
      title: dish.title,
      ingredients: dish.ingredients,
      recipe: dish.recipe,
      calories: dish.calories,
      created_by_user: userId,
      servings: dish.servings,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return newRecipe.id;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("INFO", "Function starting.");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new Error("Missing or invalid Authorization header");
    }
    const token = authHeader.replace("Bearer ", "");

    const { data: authData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;
    if (!authData.user) throw new Error("User not authenticated.");

    const user = authData.user;
    log("INFO", "User authenticated", { userId: user.id });

    const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('*').eq('user_id', user.id).single();
    if (profileError) throw profileError;

    const dietaryRestrictions = profile.dietary_restrictions?.join(', ') || 'None';
    const cuisinePreferences = profile.cuisine_preferences?.join(', ') || 'Any';
    
    const prompt = `
      Create a 7-day dinner meal plan based on the user's preferences.

      **User Preferences:**
      - Dietary Restrictions: ${dietaryRestrictions}
      - Cuisine Preferences: ${cuisinePreferences}
      - Available Cooking Time: ${profile.cooking_time || 'Any'}
      - Skill Level: ${profile.skill_level || 'Beginner'}
      - Servings per Meal: ${profile.serving_size || '2'}

      **Output Requirements:**
      - The output must be a single, minified, valid JSON object.
      - Each dish must have a list of ingredients formatted as a single string, with each ingredient prefixed by a hyphen and separated by a newline character (\\n).

      **JSON Structure Example:**
      {
        "meal_plan": [
          {
            "day": "Monday",
            "main_dish": {
              "title": "Lemon Herb Roasted Chicken",
              "ingredients": "- 1 lb chicken breast\\n- 1 tbsp olive oil\\n- 2 cloves garlic, minced",
              "recipe": "1. Preheat oven to 400°F...\\n2. Pat chicken dry...",
              "calories": 450,
              "servings": 2
            },
            "side_dish": {
              "title": "Garlic Roasted Asparagus",
              "ingredients": "- 1 bunch asparagus\\n- 1 tbsp olive oil",
              "recipe": "1. Toss asparagus...\\n2. Roast for 10-12 minutes...",
              "calories": 150
            },
            "total_time_to_cook": "45 minutes",
            "cooking_tips": "For extra crispy skin..."
          }
        ]
      }
    `;

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured.");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert chef who provides meal plans in a valid JSON format." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    
    const openaiData = await openaiResponse.json();
    const mealPlanData = JSON.parse(openaiData.choices[0].message.content);

    log("INFO", "Successfully parsed meal plan. Starting database inserts.");

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(today.setDate(diff));

    for (const [index, meal] of mealPlanData.meal_plan.entries()) {
        const mealDate = new Date(weekStartDate);
        mealDate.setDate(weekStartDate.getDate() + index);
        const mealDateStr = mealDate.toISOString().split('T')[0];

        log("INFO", `Processing meal for ${mealDateStr}`);

        const mainDishRecipeId = await saveOrGetRecipe(supabaseClient, meal.main_dish, user.id);
        log("INFO", `Saved main dish recipe`, { id: mainDishRecipeId });

        const sideDishRecipeId = await saveOrGetRecipe(supabaseClient, meal.side_dish, user.id);
        log("INFO", `Saved side dish recipe`, { id: sideDishRecipeId });

        const mealHistoryRecord = {
            user_id: user.id,
            meal_date: mealDateStr,
            main_dish_recipe_id: mainDishRecipeId,
            side_dish_recipe_id: sideDishRecipeId,
            total_time_to_cook: meal.total_time_to_cook,
            cooking_tips: meal.cooking_tips,
        };

        log("INFO", "Attempting to insert into user_meal_history", { record: mealHistoryRecord });

        const { error: historyError } = await supabaseClient
          .from('user_meal_history')
          .upsert(mealHistoryRecord, { onConflict: 'user_id,meal_date' });

        if (historyError) {
          log("ERROR", "Error inserting into user_meal_history", { error: historyError, record: mealHistoryRecord });
          throw historyError;
        }

        log("INFO", `Successfully inserted meal history for ${mealDateStr}`);
    }
    
    log("INFO", "All meals saved to database structure");

    return new Response(JSON.stringify({ success: true, mealPlan: mealPlanData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log("ERROR", "Top-level function error", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});