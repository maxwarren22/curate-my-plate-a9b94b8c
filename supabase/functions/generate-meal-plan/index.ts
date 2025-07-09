import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (level: "INFO" | "ERROR", step: string, details: unknown = {}) => {
  console.log(`[${level}] [generate-meal-plan] ${step}`, JSON.stringify(details));
};

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

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) throw profileError;
    log("INFO", "Profile loaded successfully.");

    const { data: pantryItems } = await supabaseClient
      .from('pantry_items')
      .select('ingredient_name, quantity')
      .eq('user_id', user.id);

    const { data: dislikedIngredients } = await supabaseClient
      .from('disliked_ingredients')
      .select('ingredient_name')
      .eq('user_id', user.id);

    const dietaryRestrictions = profile.dietary_restrictions?.join(', ') || 'None';
    const cuisinePreferences = profile.cuisine_preferences?.join(', ') || 'Any';
    const pantryItemsStr = pantryItems?.map((item: { ingredient_name: string; quantity: string | null }) => `${item.ingredient_name} (${item.quantity || 'some'})`).join(', ') || 'None';
    const dislikedIngredientsStr = dislikedIngredients?.map((item: { ingredient_name: string }) => item.ingredient_name).join(', ') || 'None';

    const prompt = `
      Create a 7-day dinner meal plan based on the user's preferences.

      **User Preferences:**
      - Dietary Restrictions: ${dietaryRestrictions}
      - Cuisine Preferences: ${cuisinePreferences}
      - Available Cooking Time: ${profile.cooking_time || 'Any'}
      - Skill Level: ${profile.skill_level || 'Beginner'}
      - Servings per Meal: ${profile.serving_size || '2'}
      - Weekly Budget: ${profile.budget || 'Moderate'}
      - User Name: ${profile.display_name || 'Valued User'}
      - Pantry Items to Use: ${pantryItemsStr}
      - Ingredients to Avoid: ${dislikedIngredientsStr}

      **Output Requirements:**
      - The output must be a single, minified, valid JSON object.
      - Each dish must have a list of ingredients formatted as a single string, with each ingredient prefixed by a hyphen and separated by a newline character (\\n).

      **JSON Structure Example:**
      {
        "name": "Valued User",
        "budget": "Est. $100-$120",
        "shopping_list": "- 1 lb chicken breast\\n- 1 bunch asparagus...",
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
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured in Supabase secrets.");

    log("INFO", "Calling OpenAI API with JSON mode");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional chef. Generate a valid JSON object based on the user's request, strictly following the requested structure and formats." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      log("ERROR", "OpenAI API request failed", { status: openaiResponse.status, body: errorBody });
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const mealPlanData = JSON.parse(openaiData.choices[0].message.content);

    log("INFO", "Successfully generated and parsed meal plan.");

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(today.setDate(diff));
    const weekStartStr = weekStartDate.toISOString().split('T')[0];

    const { error: saveError } = await supabaseClient
      .from('meal_plans')
      .upsert({
        user_id: user.id,
        week_start_date: weekStartStr,
        plan_data: mealPlanData,
      }, { onConflict: 'user_id,week_start_date' });

    if (saveError) {
        log("ERROR", "Database save error", saveError);
        throw saveError;
    }
    
    log("INFO", "Meal plan upsert command completed successfully.");

    return new Response(JSON.stringify({ success: true, mealPlan: mealPlanData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    log("ERROR", "Top-level function error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "An unknown server error occurred." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});