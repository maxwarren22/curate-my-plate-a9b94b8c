import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Recipe } from "../../../src/types/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Profile {
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  cooking_time?: string;
  skill_level?: string;
  serving_size?: string;
  budget?: string;
  display_name?: string;
  generations_remaining: number;
  kitchen_equipment?: string[];
  protein_preferences?: string[];
  health_goals?: string;
}

interface Subscription {
    status: string;
}

interface PantryItem {
  ingredient_name: string;
  quantity: string | null;
}

interface DislikedItem {
  ingredient_name: string;
}

interface RecipeInfo {
  title: string;
}

const log = (level: "INFO" | "ERROR", step: string, details: unknown = {}) => {
  console.log(`[${level}] [generate-meal-plan] ${step}`, JSON.stringify(details));
};

async function createEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create embedding: ${await response.text()}`);
  }

  const { data } = await response.json();
  return data[0].embedding;
}

async function saveOrGetRecipe(
  supabaseClient: SupabaseClient,
  dish: Recipe,
  userId: string,
  openaiApiKey: string
): Promise<string> {
  const embeddingText = `${dish.title}\n${dish.ingredients}`;
  const newEmbedding = await createEmbedding(embeddingText, openaiApiKey);

  const { data: similarRecipes, error: matchError } = await supabaseClient.rpc('match_recipe', {
    query_embedding: newEmbedding,
    match_threshold: 0.95,
    match_count: 1
  });

  if (matchError) {
    log("ERROR", "Error matching recipe", matchError);
    throw matchError;
  }

  if (similarRecipes && similarRecipes.length > 0) {
    log("INFO", `Found similar recipe: "${similarRecipes[0].title}" for new recipe "${dish.title}"`);
    return similarRecipes[0].id;
  }

  log("INFO", `No similar recipe found. Creating new recipe: "${dish.title}"`);
  const { data: newRecipe, error: insertError } = await supabaseClient
      .from('recipes')
      .insert({
          title: dish.title,
          ingredients: dish.ingredients,
          recipe: dish.recipe,
          calories: dish.calories,
          created_by_user: userId,
          embedding: newEmbedding
      })
      .select('id')
      .single();

  if (insertError) {
    log("ERROR", "Error inserting new recipe", insertError);
    throw insertError;
  }

  if (!newRecipe) {
      throw new Error("Failed to create new recipe.");
  }

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

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single<Profile>();

    if (profileError) throw profileError;
    log("INFO", "Profile loaded successfully.");
    
    const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .single<Subscription>();

    if (subError && subError.code !== 'PGRST116') {
        log("ERROR", "Could not fetch subscription status", { error: subError.message });
    }
    
    const isTrialUser = !subscription || subscription.status === 'trial';
    
    if (isTrialUser) {
        if (profile.generations_remaining <= 0) {
            throw new Error("You have no trial generations left. Please subscribe to continue.");
        }
        
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ generations_remaining: profile.generations_remaining - 1 })
            .eq('user_id', user.id);

        if (updateError) {
            log("ERROR", "Failed to decrement generations_remaining", { error: updateError.message });
        }
    }

    const { data: pantryItems } = await supabaseClient
      .from('pantry_items')
      .select('ingredient_name, quantity')
      .eq('user_id', user.id);

    const { data: dislikedIngredients } = await supabaseClient
      .from('disliked_ingredients')
      .select('ingredient_name')
      .eq('user_id', user.id);

    const { data: likedRecipesData } = await supabaseClient
      .from('user_meal_history')
      .select('main_dish_recipe_id, recipes!main_dish_recipe_id(title)')
      .eq('user_id', user.id)
      .eq('rating', 1);
      
    const { data: dislikedRecipesData } = await supabaseClient
      .from('user_meal_history')
      .select('main_dish_recipe_id, recipes!main_dish_recipe_id(title)')
      .eq('user_id', user.id)
      .eq('rating', -1);
      
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const { data: recentMealsData, error: recentMealsError } = await supabaseClient
        .from('user_meal_history')
        .select('recipes!main_dish_recipe_id(title)')
        .eq('user_id', user.id)
        .gte('meal_date', twoWeeksAgo.toISOString().split('T')[0]);

    if(recentMealsError) {
        log("ERROR", "Error fetching recent meals", recentMealsError);
    }

    const recentMealsStr = recentMealsData?.map((item: { recipes: { title: string }[] | null }) => item.recipes?.[0]?.title).filter(Boolean).join(', ') || 'None';

    const likedRecipes = likedRecipesData as { recipes: RecipeInfo | null }[] | null;
    const dislikedRecipes = dislikedRecipesData as { recipes: RecipeInfo | null }[] | null;

    const dietaryRestrictions = profile.dietary_restrictions?.join(', ') || 'None';
    const cuisinePreferences = profile.cuisine_preferences?.join(', ') || 'Any';
    const pantryItemsStr = (pantryItems as PantryItem[])?.map((item) => `${item.ingredient_name} (${item.quantity || 'some'})`).join(', ') || 'None';
    const dislikedIngredientsStr = (dislikedIngredients as DislikedItem[])?.map((item) => item.ingredient_name).join(', ') || 'None';
    const likedRecipesStr = likedRecipes?.map((item) => item.recipes?.title).filter(Boolean).join(', ') || 'None';
    const dislikedRecipesStr = dislikedRecipes?.map((item) => item.recipes?.title).filter(Boolean).join(', ') || 'None';
    const healthGoalsStr = profile.health_goals || 'Not specified';

    let premiumPreferences = '';
    if (!isTrialUser) {
        premiumPreferences = `
        **Premium Subscriber Preferences:**
        - Available Kitchen Equipment: ${profile.kitchen_equipment?.join(', ') || 'Not specified'}
        - Protein Preferences: ${profile.protein_preferences?.join(', ') || 'Not specified'}
        `;
    }

    const prompt = `
      Create a 7-day dinner meal plan based on the user's preferences.

      **User Preferences:**
      - Dietary Restrictions: ${dietaryRestrictions}
      - Cuisine Preferences: ${cuisinePreferences}
      - Health & Fitness Goals: ${healthGoalsStr}
      - Available Cooking Time: ${profile.cooking_time || 'Any'}
      - Skill Level: ${profile.skill_level || 'Beginner'}
      - Servings per Meal: ${profile.serving_size || '2'}
      - Weekly Budget: ${profile.budget || 'Moderate'}
      - User Name: ${profile.display_name || 'Valued User'}
      - Pantry Items to Use: ${pantryItemsStr}
      - Ingredients to Avoid: ${dislikedIngredientsStr}
      - Previously Liked Recipes: ${likedRecipesStr} (Use these for inspiration on style and flavors, but prioritize new meal ideas.)
      - Previously Disliked Recipes: ${dislikedRecipesStr} (Avoid these and similar meals entirely.)

      ${premiumPreferences}

      **Recent Meal History to Avoid:**
      - The user has recently had the following meals. Do not include these specific dishes in the new plan: ${recentMealsStr}

      **Creative Mandate:**
      - **Prioritize Variety:** Your primary goal is to generate a new and interesting meal plan. Do not repeat any meals from the "Recent Meal History to Avoid" list.
      - **Be Creative:** If the user enjoys a wide range of cuisines, feel free to introduce a "Chef's Special" or a meal from a related cuisine to keep the plan interesting.

      **Output Requirements:**
      - The output must be a single, minified, valid JSON object.
      - Each dish must have a list of ingredients formatted as a single string, with each ingredient prefixed by a hyphen and separated by a newline character (\\n).
      - **Crucially, the shopping_list must be an array of objects.** Each object must have a "category" and an "items" array.
      - **Use the following categories in this exact order:** "Produce", "Protein", "Dairy", "Bakery", "Pantry", "Canned Goods", "Spices", "Other".
      - **Categorize items correctly.** For example, canned goods like '1 can of chickpeas' belong in the "Canned Goods" category, not "Pantry".

      **JSON Structure Example:**
      {
        "name": "Valued User",
        "budget": "Est. $100-$120",
        "shopping_list": [
          { "category": "Produce", "items": ["1 bunch asparagus", "2 cloves garlic"] },
          { "category": "Protein", "items": ["1 lb chicken breast"] },
          { "category": "Pantry", "items": ["1 tbsp olive oil"] },
          { "category": "Canned Goods", "items": ["1 can of chickpeas"] }
        ],
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
        temperature: 0.8,
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
    const planData = JSON.parse(openaiData.choices[0].message.content);

    log("INFO", "Successfully generated and parsed meal plan.");

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(today.setDate(diff));
    const weekStartDateString = weekStartDate.toISOString().split('T')[0];

    if (planData.shopping_list) {
      await supabaseClient
        .from('shopping_lists')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start_date', weekStartDateString);
    
      const { error: shoppingListError } = await supabaseClient
        .from('shopping_lists')
        .insert({ 
          user_id: user.id, 
          week_start_date: weekStartDateString,
          shopping_list: planData.shopping_list,
          budget: planData.budget
        });
    
      if (shoppingListError) {
        log("ERROR", "Error inserting shopping list", shoppingListError);
      } else {
        log("INFO", "Shopping list inserted successfully");
      }
    }
    
    for (let i = 0; i < planData.meal_plan.length; i++) {
        const meal = planData.meal_plan[i];
        const mealDate = new Date(weekStartDate);
        mealDate.setDate(weekStartDate.getDate() + i);
        const mealDateStr = mealDate.toISOString().split('T')[0];
    
        const mainDishRecipeId = await saveOrGetRecipe(supabaseClient, meal.main_dish, user.id, openaiApiKey);
        const sideDishRecipeId = await saveOrGetRecipe(supabaseClient, meal.side_dish, user.id, openaiApiKey);
    
        const { error: mealHistoryError } = await supabaseClient
            .from('user_meal_history')
            .upsert({
                user_id: user.id,
                main_dish_recipe_id: mainDishRecipeId,
                side_dish_recipe_id: sideDishRecipeId,
                meal_date: mealDateStr,
                total_time_to_cook: meal.total_time_to_cook,
                cooking_tips: meal.cooking_tips,
            }, { onConflict: 'user_id, meal_date' });
    
        if (mealHistoryError) {
            log("ERROR", "Error upserting to meal history", mealHistoryError);
            throw mealHistoryError;
        }
    }

    log("INFO", "All meals saved to normalized database structure");

    return new Response(JSON.stringify({ success: true, mealPlan: planData }), {
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