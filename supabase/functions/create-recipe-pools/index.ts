import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  nutrition?: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
  extendedIngredients?: Array<{
    id: number;
    aisle: string;
    image: string;
    name: string;
    amount: number;
    unit: string;
    original: string;
  }>;
  analyzedInstructions?: Array<{
    steps: Array<{
      number: number;
      step: string;
    }>;
  }>;
  pricePerServing?: number;
  healthScore?: number;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CREATE-RECIPE-POOLS] Starting recipe pool creation');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const spoonacularApiKey = Deno.env.get('SPOONACULAR_API_KEY');
    if (!spoonacularApiKey) {
      throw new Error('SPOONACULAR_API_KEY not found');
    }

    const { cuisines = [], dietaryRestrictions = [] } = await req.json();
    
    console.log(`[CREATE-RECIPE-POOLS] Requested cuisines: ${cuisines.join(', ')}`);
    console.log(`[CREATE-RECIPE-POOLS] Requested dietary restrictions: ${dietaryRestrictions.join(', ')}`);

    // Create preference hash for caching
    const preferenceHash = btoa(JSON.stringify({
      cuisines: cuisines.sort(),
      dietaryRestrictions: dietaryRestrictions.sort()
    }));

    console.log(`[CREATE-RECIPE-POOLS] Generated preference hash: ${preferenceHash}`);

    // Check if we have a recent recipe pool (within 1 month)
    const { data: existingPool, error: poolError } = await supabaseClient
      .from('recipe_pools')
      .select('*')
      .eq('preference_hash', preferenceHash)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (poolError) {
      console.error('[CREATE-RECIPE-POOLS] Error checking existing pools:', poolError);
    }

    if (existingPool) {
      console.log(`[CREATE-RECIPE-POOLS] Found existing pool with ${JSON.parse(existingPool.recipes).length} recipes`);
      return new Response(JSON.stringify({ 
        success: true, 
        poolId: existingPool.id,
        recipeCount: JSON.parse(existingPool.recipes).length,
        cached: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[CREATE-RECIPE-POOLS] No existing pool found, creating new one');

    // Build Spoonacular query parameters
    const queryParams = new URLSearchParams({
      apiKey: spoonacularApiKey,
      number: '500', // Request maximum recipes
      addRecipeInformation: 'true',
      addRecipeNutrition: 'true',
      instructionsRequired: 'true',
      fillIngredients: 'true',
      sort: 'popularity'
    });

    if (cuisines.length > 0) {
      queryParams.append('cuisine', cuisines.join(','));
    }

    if (dietaryRestrictions.length > 0) {
      queryParams.append('diet', dietaryRestrictions.join(','));
    }

    console.log(`[CREATE-RECIPE-POOLS] Fetching recipes from Spoonacular with params: ${queryParams.toString()}`);

    const spoonacularUrl = `https://api.spoonacular.com/recipes/complexSearch?${queryParams.toString()}`;
    const spoonacularResponse = await fetch(spoonacularUrl);

    if (!spoonacularResponse.ok) {
      throw new Error(`Spoonacular API error: ${spoonacularResponse.status}`);
    }

    const spoonacularData = await spoonacularResponse.json();
    console.log(`[CREATE-RECIPE-POOLS] Spoonacular returned ${spoonacularData.results?.length || 0} recipes`);

    if (!spoonacularData.results || spoonacularData.results.length === 0) {
      throw new Error('No recipes found from Spoonacular');
    }

    // Convert Spoonacular recipes to our format
    const convertedRecipes = spoonacularData.results.map((recipe: SpoonacularRecipe) => {
      const ingredients = recipe.extendedIngredients?.map(ing => ing.original).join('\n') || 
        'Ingredients not available';
      
      const instructions = recipe.analyzedInstructions?.[0]?.steps
        ?.map(step => `${step.number}. ${step.step}`)
        .join('\n') || 'Instructions not available';

      const calories = recipe.nutrition?.nutrients
        ?.find(n => n.name === 'Calories')?.amount || 0;

      return {
        id: crypto.randomUUID(),
        spoonacular_id: recipe.id,
        title: recipe.title,
        ingredients,
        recipe: instructions,
        image_url: recipe.image,
        source_url: recipe.sourceUrl,
        servings: recipe.servings,
        ready_in_minutes: recipe.readyInMinutes,
        calories: Math.round(calories),
        price_per_serving: recipe.pricePerServing || null,
        health_score: recipe.healthScore || null,
        source_type: 'spoonacular',
        created_at: new Date().toISOString()
      };
    });

    console.log(`[CREATE-RECIPE-POOLS] Converted ${convertedRecipes.length} recipes`);

    // Save recipe pool with 1 month expiration
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { data: newPool, error: insertError } = await supabaseClient
      .from('recipe_pools')
      .insert({
        preference_hash: preferenceHash,
        recipes: JSON.stringify(convertedRecipes),
        cuisine_preferences: cuisines,
        dietary_restrictions: dietaryRestrictions,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[CREATE-RECIPE-POOLS] Error saving recipe pool:', insertError);
      throw insertError;
    }

    console.log(`[CREATE-RECIPE-POOLS] Successfully created recipe pool with ID: ${newPool.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      poolId: newPool.id,
      recipeCount: convertedRecipes.length,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CREATE-RECIPE-POOLS] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});