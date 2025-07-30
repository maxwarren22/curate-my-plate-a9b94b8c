import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getSupabaseClient(serviceRoleKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function generateMealPlan(req: Request, supabase: any, openAIApiKey: string) {
  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('🚨 Authentication error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`✅ User authenticated: ${user.id}`);

    // The rest of the function logic remains the same...
    // 1. Check subscription status and generation quota
    console.log('🔍 Checking subscription status...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status, generations_remaining, dietary_restrictions, cuisine_preferences, health_goals, cooking_time, meal_types')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('🚨 Profile not found for user:', user.id, profileError?.message);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`✅ Profile found. Status: ${profile.subscription_status}, Generations remaining: ${profile.generations_remaining}`);

    if (profile.subscription_status === 'trial' && (profile.generations_remaining || 0) <= 0) {
      console.warn(`🚫 User ${user.id} has no trial generations left.`);
      return new Response(JSON.stringify({ error: 'No meal generations remaining. Please upgrade.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch user data
    console.log('📋 Fetching user preferences and history...');
    const [
      pantryResponse,
      dislikedIngredientsResponse,
      dislikedRecipesResponse,
      likedRecipesResponse,
      mealHistoryResponse,
    ] = await Promise.all([
      supabase.from('pantry_items').select('ingredient_name').eq('user_id', user.id),
      supabase.from('disliked_ingredients').select('ingredient_name').eq('user_id', user.id),
      supabase.from('disliked_recipes').select('recipes(title)').eq('user_id', user.id),
      supabase.from('liked_recipes').select('recipes(title)').eq('user_id', user.id),
      supabase.from('user_meal_history')
        .select('recipes!main_dish_recipe_id(title)')
        .eq('user_id', user.id)
        .gte('meal_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    const pantryItems = pantryResponse.data?.map(item => item.ingredient_name) || [];
    const dislikedIngredients = dislikedIngredientsResponse.data?.map(item => item.ingredient_name) || [];
    const dislikedRecipes = dislikedRecipesResponse.data?.map(item => item.recipes?.title).filter(Boolean) || [];
    const likedRecipes = likedRecipesResponse.data?.map(item => item.recipes?.title).filter(Boolean) || [];
    const recentRecipeTitles = mealHistoryResponse.data?.map(item => item.recipes?.title).filter(Boolean) || [];
    console.log('✅ User data fetched successfully.');

    // 3. Generate meal plan with OpenAI
    const mealPlanPrompt = `
      You are a master chef creating a personalized 7-day meal plan.

      User Profile:
      - Dietary Restrictions: ${profile.dietary_restrictions?.join(', ') || 'none'}
      - Cuisine Preferences: ${profile.cuisine_preferences?.join(', ') || 'varied'}
      - Health Goals: ${profile.health_goals || 'balanced diet'}
      - Preferred Cooking Time: ${profile.cooking_time || '30-45 minutes'}
      - Meal Types: ${profile.meal_types?.join(', ') || 'Dinner'}

      User Pantry & Preferences:
      - Pantry Items: ${pantryItems.join(', ') || 'none'}
      - Disliked Ingredients: ${dislikedIngredients.join(', ') || 'none'}
      - Liked Recipes: ${likedRecipes.join(', ') || 'none'}
      - Disliked Recipes: ${dislikedRecipes.join(', ') || 'none'}
      - Recipes from last 2 weeks (avoid repeating): ${recentRecipeTitles.join(', ') || 'none'}

      Generate a 7-day meal plan. For each day, provide a main dish and an optional, complementary side dish.

      For EACH main dish and side dish, provide the following JSON structure:
      {
        "title": "Recipe Title",
        "description": "A brief, enticing description of the dish.",
        "ingredients": "A newline-separated string of ingredients with quantities.",
        "recipe": "A newline-separated string of step-by-step cooking instructions.",
        "calories": A number representing the estimated calories per serving.",
        "servings": A number representing the number of servings.",
        "prep_time": A number for the prep time in minutes.",
        "cook_time": A number for the cook time in minutes."
      }

      For EACH day of the week, provide the following JSON structure:
      {
        "day": "Monday",
        "main_dish": { ... a full recipe object ... },
        "side_dish": { ... a full recipe object ... },
        "total_time_to_cook": "A string for the total time (e.g., '45 minutes').",
        "cooking_tips": "A helpful cooking tip for the day's meal."
      }

      Return ONLY a single JSON object containing a "meal_plan" key, which holds an array of 7 day objects.
    `;

    console.log('🤖 Sending prompt to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: mealPlanPrompt }],
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('🚨 OpenAI request failed:', response.status, errorBody);
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const mealPlan = JSON.parse(content).meal_plan;
    console.log('✅ OpenAI response received and parsed.');

    // 4. Save the meal plan to the database
    console.log('💾 Saving meal plan to database...');
    await saveMealPlanToDatabase(user.id, mealPlan, supabase);
    console.log('✅ Meal plan saved successfully.');

    // 5. Generate the shopping list
    console.log('🛒 Triggering shopping list generation...');
    const allIngredients = mealPlan.flatMap((day: any) => [
        day.main_dish.ingredients,
        day.side_dish?.ingredients
    ]).filter(Boolean);

    const { error: shoppingListError } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
            ingredients: allIngredients,
            pantryItems: pantryItems.map(name => ({ ingredient_name: name })),
        }
    });
    if (shoppingListError) {
        console.error('🚨 Shopping list generation failed:', shoppingListError.message);
    } else {
        console.log('✅ Shopping list generated successfully.');
    }

    // 6. Decrement generation count for trial users
    if (profile.subscription_status === 'trial') {
      console.log('💳 Decrementing trial generation count...');
      await supabase
        .from('profiles')
        .update({ generations_remaining: (profile.generations_remaining || 1) - 1 })
        .eq('user_id', user.id);
      console.log('✅ Trial count updated.');
    }

    console.log('🎉 Meal plan generation process completed successfully.');
    return new Response(JSON.stringify({ success: true, message: 'Meal plan generated successfully', mealPlan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 Top-level error in generate-meal-plan function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

serve(async (req) => {
  console.log('🚀 Meal plan generation function invoked.');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  const supabase = await getSupabaseClient(supabaseServiceKey);

  return await generateMealPlan(req, supabase, openAIApiKey);
});

async function saveMealPlanToDatabase(userId: string, mealPlan: any[], supabase: any): Promise<void> {
  const recipesToSave = [];
  for (const day of mealPlan) {
    if (day.main_dish) {
        day.main_dish.id = crypto.randomUUID();
        recipesToSave.push(day.main_dish);
    }
    if (day.side_dish) {
      day.side_dish.id = crypto.randomUUID();
      recipesToSave.push(day.side_dish);
    }
  }

  const { error: recipeError } = await supabase
    .from('recipes')
    .upsert(recipesToSave.map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      recipe: recipe.recipe,
      calories: recipe.calories,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      created_by_user: userId,
    })), { onConflict: 'id' });

  if (recipeError) {
    console.error('🚨 Database error saving recipes:', recipeError.message);
    throw new Error(`Failed to save recipes: ${recipeError.message}`);
  }

  const mealHistoryData = mealPlan.map((day, index) => {
    const mealDate = new Date();
    mealDate.setDate(mealDate.getDate() + index);
    return {
      user_id: userId,
      meal_date: mealDate.toISOString().split('T')[0],
      main_dish_recipe_id: day.main_dish.id,
      side_dish_recipe_id: day.side_dish?.id || null,
      total_time_to_cook: day.total_time_to_cook,
      cooking_tips: day.cooking_tips,
    };
  });

  const { error: historyError } = await supabase
    .from('user_meal_history')
    .upsert(mealHistoryData, { onConflict: 'user_id,meal_date' });

  if (historyError) {
    console.error('🚨 Database error saving meal history:', historyError.message);
    throw new Error(`Failed to save meal history: ${historyError.message}`);
  }
}