import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoredRecipe {
  id: string;
  spoonacular_id: number;
  title: string;
  ingredients: string;
  recipe: string;
  image_url: string;
  ready_in_minutes: number;
  calories: number;
  price_per_serving: number;
  health_score: number;
  servings: number;
  score: number;
  scoreBreakdown: {
    budget: number;
    health: number;
    time: number;
    complexity: number;
    preference: number;
  };
}

interface DayMeal {
  day: string;
  mainDish: ScoredRecipe;
  sideDish?: ScoredRecipe;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[GENERATE-WEEKLY-PLAN] Starting weekly plan generation');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY not found');
    }

    const { userId, userPoolId } = await req.json();
    
    if (!userId || !userPoolId) {
      throw new Error('userId and userPoolId are required');
    }

    console.log(`[GENERATE-WEEKLY-PLAN] Generating plan for user: ${userId}, pool: ${userPoolId}`);

    // Get user profile and pantry
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const { data: pantryItems } = await supabaseClient
      .from('pantry_items')
      .select('ingredient_name, quantity')
      .eq('user_id', userId);

    console.log(`[GENERATE-WEEKLY-PLAN] User has ${pantryItems?.length || 0} pantry items`);

    // Get user's scored recipes
    const { data: userPool, error: poolError } = await supabaseClient
      .from('user_recipe_pools')
      .select('*')
      .eq('id', userPoolId)
      .single();

    if (poolError || !userPool) {
      throw new Error('User recipe pool not found');
    }

    const scoredRecipes: ScoredRecipe[] = JSON.parse(userPool.scored_recipes);
    console.log(`[GENERATE-WEEKLY-PLAN] Loaded ${scoredRecipes.length} scored recipes`);

    // Prepare data for AI selection
    const pantryList = pantryItems?.map(item => `${item.ingredient_name} (${item.quantity || 'some'})`).join(', ') || 'No pantry items';
    
    // Create recipe summaries for AI prompt
    const recipeSummaries = scoredRecipes.slice(0, 50).map((recipe, index) => {
      return `${index + 1}. ${recipe.title} (Score: ${recipe.score}, Time: ${recipe.ready_in_minutes}min, Calories: ${recipe.calories}, Price: $${recipe.price_per_serving?.toFixed(2) || 'N/A'})`;
    }).join('\n');

    const aiPrompt = `You are a meal planning expert. Select 7 diverse dinner recipes for a weekly meal plan based on the following criteria:

USER PROFILE:
- Budget: ${profile.budget}
- Health Goals: ${profile.health_goals}
- Cooking Time Preference: ${profile.cooking_time}
- Skill Level: ${profile.skill_level}
- Dietary Restrictions: ${profile.dietary_restrictions?.join(', ') || 'None'}
- Cuisine Preferences: ${profile.cuisine_preferences?.join(', ') || 'Any'}

PANTRY ITEMS: ${pantryList}

AVAILABLE RECIPES (Top 50 by score):
${recipeSummaries}

Please select exactly 7 recipes (one for each day Monday-Sunday) that:
1. Maximize variety in cuisine types and cooking methods
2. Consider the user's pantry items to minimize shopping needs
3. Balance the weekly budget and nutrition
4. Respect cooking time preferences
5. Ensure good variety in protein sources

Respond with ONLY a JSON array of 7 numbers corresponding to the recipe numbers (1-50) in order from Monday to Sunday. For example: [1, 15, 3, 22, 8, 31, 12]`;

    console.log('[GENERATE-WEEKLY-PLAN] Sending request to OpenAI for recipe selection');

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a meal planning expert. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      }),
    });

    if (!openAiResponse.ok) {
      throw new Error(`OpenAI API error: ${openAiResponse.status}`);
    }

    const openAiData = await openAiResponse.json();
    const aiSelection = openAiData.choices[0].message.content.trim();
    
    console.log(`[GENERATE-WEEKLY-PLAN] AI selection: ${aiSelection}`);

    let selectedRecipeIndices: number[];
    try {
      selectedRecipeIndices = JSON.parse(aiSelection);
    } catch (e) {
      console.error('[GENERATE-WEEKLY-PLAN] Failed to parse AI response, using fallback selection');
      // Fallback: select top 7 recipes with variety
      selectedRecipeIndices = [1, 2, 3, 4, 5, 6, 7];
    }

    // Create weekly meal plan
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weeklyMeals: DayMeal[] = days.map((day, index) => {
      const recipeIndex = selectedRecipeIndices[index] - 1; // Convert to 0-based index
      const selectedRecipe = scoredRecipes[recipeIndex] || scoredRecipes[index % scoredRecipes.length];
      
      return {
        day,
        mainDish: selectedRecipe
      };
    });

    console.log(`[GENERATE-WEEKLY-PLAN] Selected recipes for 7 days`);

    // Save recipes to database if they don't exist
    const allRecipes = weeklyMeals.map(meal => meal.mainDish);
    
    for (const recipe of allRecipes) {
      const { error: recipeError } = await supabaseClient
        .from('recipes')
        .upsert({
          id: recipe.id,
          spoonacular_id: recipe.spoonacular_id,
          title: recipe.title,
          ingredients: recipe.ingredients,
          recipe: recipe.recipe,
          image_url: recipe.image_url,
          servings: recipe.servings,
          ready_in_minutes: recipe.ready_in_minutes,
          calories: recipe.calories,
          price_per_serving: recipe.price_per_serving,
          health_score: recipe.health_score,
          source_type: 'spoonacular'
        }, { onConflict: 'spoonacular_id' });

      if (recipeError) {
        console.error('[GENERATE-WEEKLY-PLAN] Error saving recipe:', recipeError);
      }
    }

    console.log('[GENERATE-WEEKLY-PLAN] Saved recipes to database');

    // Calculate week start date (next Monday)
    const today = new Date();
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() + daysUntilMonday);

    // Save meal plan to user_meal_history
    for (let i = 0; i < weeklyMeals.length; i++) {
      const meal = weeklyMeals[i];
      const mealDate = new Date(weekStartDate);
      mealDate.setDate(weekStartDate.getDate() + i);

      const { error: mealError } = await supabaseClient
        .from('user_meal_history')
        .upsert({
          user_id: userId,
          meal_date: mealDate.toISOString().split('T')[0],
          main_dish_recipe_id: meal.mainDish.id,
          side_dish_recipe_id: meal.sideDish?.id || null
        }, { onConflict: 'user_id,meal_date' });

      if (mealError) {
        console.error('[GENERATE-WEEKLY-PLAN] Error saving meal history:', mealError);
      }
    }

    console.log('[GENERATE-WEEKLY-PLAN] Saved weekly meal plan to history');

    // Generate shopping list
    console.log('[GENERATE-WEEKLY-PLAN] Generating shopping list...');
    
    const allIngredients: Array<{ name: string; quantity: string; recipe: string }> = [];
    
    weeklyMeals.forEach(meal => {
      const ingredientLines = meal.mainDish.ingredients.split('\n').filter(line => line.trim());
      ingredientLines.forEach(ingredient => {
        allIngredients.push({
          name: ingredient.trim(),
          quantity: '1', // Will be processed by AI
          recipe: meal.mainDish.title
        });
      });
    });

    // Process shopping list with OpenAI
    const { data: processedList, error: listError } = await supabaseClient.functions
      .invoke('process-shopping-list', {
        body: { 
          ingredients: allIngredients,
          pantryItems: pantryItems || []
        }
      });

    if (listError) {
      console.error('[GENERATE-WEEKLY-PLAN] Error processing shopping list:', listError);
    }

    // Save shopping list
    const { error: shoppingError } = await supabaseClient
      .from('shopping_lists')
      .upsert({
        user_id: userId,
        week_start_date: weekStartDate.toISOString().split('T')[0],
        budget: profile.budget,
        shopping_list: JSON.stringify([]),
        ai_processed_ingredients: processedList?.processedIngredients || null
      }, { onConflict: 'user_id,week_start_date' });

    if (shoppingError) {
      console.error('[GENERATE-WEEKLY-PLAN] Error saving shopping list:', shoppingError);
    }

    console.log('[GENERATE-WEEKLY-PLAN] Weekly plan generation completed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      mealPlan: weeklyMeals,
      weekStartDate: weekStartDate.toISOString().split('T')[0],
      shoppingListGenerated: !listError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GENERATE-WEEKLY-PLAN] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});