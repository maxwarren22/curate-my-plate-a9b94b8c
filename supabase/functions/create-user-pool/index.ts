import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recipe {
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
}

interface UserProfile {
  budget: string;
  health_goals: string;
  cooking_time: string;
  skill_level: string;
  subscription_status: string;
  generations_remaining: number;
}

interface ScoredRecipe extends Recipe {
  score: number;
  scoreBreakdown: {
    budget: number;
    health: number;
    time: number;
    complexity: number;
    preference: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CREATE-USER-POOL] Starting user-specific pool creation');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, poolId } = await req.json();
    
    if (!userId || !poolId) {
      throw new Error('userId and poolId are required');
    }

    console.log(`[CREATE-USER-POOL] Processing for user: ${userId}, pool: ${poolId}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    console.log(`[CREATE-USER-POOL] User profile loaded - subscription: ${profile.subscription_status}`);

    // Check if user pool already exists and is valid
    const userPoolHash = `${userId}-${poolId}`;
    const { data: existingUserPool, error: userPoolError } = await supabaseClient
      .from('user_recipe_pools')
      .select('*')
      .eq('user_pool_hash', userPoolHash)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (userPoolError) {
      console.error('[CREATE-USER-POOL] Error checking existing user pools:', userPoolError);
    }

    if (existingUserPool) {
      console.log(`[CREATE-USER-POOL] Found existing user pool with ${JSON.parse(existingUserPool.scored_recipes).length} recipes`);
      return new Response(JSON.stringify({ 
        success: true, 
        userPoolId: existingUserPool.id,
        recipeCount: JSON.parse(existingUserPool.scored_recipes).length,
        cached: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get recipe pool
    const { data: recipePool, error: poolError } = await supabaseClient
      .from('recipe_pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError || !recipePool) {
      throw new Error('Recipe pool not found');
    }

    const recipes: Recipe[] = JSON.parse(recipePool.recipes);
    console.log(`[CREATE-USER-POOL] Loaded ${recipes.length} recipes from pool`);

    // Get user's liked and disliked recipes
    const { data: likedRecipes } = await supabaseClient
      .from('liked_recipes')
      .select('recipe_id')
      .eq('user_id', userId);

    const { data: dislikedRecipes } = await supabaseClient
      .from('disliked_recipes')
      .select('recipe_id')
      .eq('user_id', userId);

    const { data: dislikedIngredients } = await supabaseClient
      .from('disliked_ingredients')
      .select('ingredient_name')
      .eq('user_id', userId);

    const likedRecipeIds = new Set(likedRecipes?.map(r => r.recipe_id) || []);
    const dislikedRecipeIds = new Set(dislikedRecipes?.map(r => r.recipe_id) || []);
    const dislikedIngredientNames = new Set(dislikedIngredients?.map(i => i.ingredient_name.toLowerCase()) || []);

    console.log(`[CREATE-USER-POOL] User preferences loaded - ${likedRecipeIds.size} liked, ${dislikedRecipeIds.size} disliked recipes, ${dislikedIngredientNames.size} disliked ingredients`);

    // Score recipes based on user preferences
    const scoredRecipes: ScoredRecipe[] = recipes
      .filter(recipe => {
        // Filter out disliked recipes
        if (dislikedRecipeIds.has(recipe.id)) return false;
        
        // Filter out recipes with disliked ingredients
        const hasDislikedIngredient = Array.from(dislikedIngredientNames).some(ingredient =>
          recipe.ingredients.toLowerCase().includes(ingredient)
        );
        if (hasDislikedIngredient) return false;
        
        return true;
      })
      .map(recipe => {
        const score = calculateRecipeScore(recipe, profile as UserProfile, likedRecipeIds.has(recipe.id));
        return {
          ...recipe,
          ...score
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 200); // Keep top 200 recipes

    console.log(`[CREATE-USER-POOL] Scored and filtered to ${scoredRecipes.length} recipes`);

    // Set expiration based on subscription status
    const expiresAt = new Date();
    if (profile.subscription_status === 'trial') {
      // For trial users, expire when they run out of generations
      expiresAt.setDate(expiresAt.getDate() + 7); // 1 week max
    } else {
      // For subscribers, refresh monthly
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Save user pool
    const { data: newUserPool, error: insertError } = await supabaseClient
      .from('user_recipe_pools')
      .insert({
        user_id: userId,
        recipe_pool_id: poolId,
        user_pool_hash: userPoolHash,
        scored_recipes: JSON.stringify(scoredRecipes),
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[CREATE-USER-POOL] Error saving user pool:', insertError);
      throw insertError;
    }

    console.log(`[CREATE-USER-POOL] Successfully created user pool with ID: ${newUserPool.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      userPoolId: newUserPool.id,
      recipeCount: scoredRecipes.length,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CREATE-USER-POOL] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateRecipeScore(recipe: Recipe, profile: UserProfile, isLiked: boolean) {
  let budgetScore = 0;
  let healthScore = 0;
  let timeScore = 0;
  let complexityScore = 0;
  let preferenceScore = isLiked ? 20 : 0; // Bonus for liked recipes

  // Budget scoring (0-25 points)
  const pricePerServing = recipe.price_per_serving || 5; // Default $5 if not available
  switch (profile.budget) {
    case 'low':
      budgetScore = Math.max(0, 25 - (pricePerServing * 5));
      break;
    case 'medium':
      budgetScore = pricePerServing <= 8 ? 25 : Math.max(0, 25 - ((pricePerServing - 8) * 3));
      break;
    case 'high':
      budgetScore = 25; // No budget constraints
      break;
    default:
      budgetScore = 15;
  }

  // Health scoring (0-25 points)
  const healthScoreValue = recipe.health_score || 50;
  if (profile.health_goals === 'weight_loss') {
    healthScore = Math.min(25, (healthScoreValue / 100) * 25 + (recipe.calories < 500 ? 5 : 0));
  } else if (profile.health_goals === 'muscle_gain') {
    healthScore = Math.min(25, (healthScoreValue / 100) * 20 + (recipe.calories > 600 ? 5 : 0));
  } else {
    healthScore = (healthScoreValue / 100) * 25;
  }

  // Time scoring (0-25 points)
  const cookTime = recipe.ready_in_minutes || 30;
  switch (profile.cooking_time) {
    case 'quick':
      timeScore = cookTime <= 20 ? 25 : Math.max(0, 25 - ((cookTime - 20) * 1.5));
      break;
    case 'medium':
      timeScore = cookTime <= 45 ? 25 : Math.max(0, 25 - ((cookTime - 45) * 1));
      break;
    case 'long':
      timeScore = 25; // No time constraints
      break;
    default:
      timeScore = cookTime <= 30 ? 25 : Math.max(0, 25 - ((cookTime - 30) * 1));
  }

  // Complexity scoring (0-25 points) - based on ingredient count and instructions
  const ingredientCount = recipe.ingredients.split('\n').length;
  const instructionCount = recipe.recipe.split('\n').length;
  let complexityLevel = 0;
  
  if (ingredientCount <= 5 && instructionCount <= 5) complexityLevel = 1; // Simple
  else if (ingredientCount <= 10 && instructionCount <= 8) complexityLevel = 2; // Medium
  else complexityLevel = 3; // Complex

  switch (profile.skill_level) {
    case 'beginner':
      complexityScore = complexityLevel === 1 ? 25 : complexityLevel === 2 ? 15 : 5;
      break;
    case 'intermediate':
      complexityScore = complexityLevel === 2 ? 25 : complexityLevel === 1 ? 20 : 15;
      break;
    case 'advanced':
      complexityScore = 25; // Can handle any complexity
      break;
    default:
      complexityScore = complexityLevel === 2 ? 25 : 15;
  }

  const totalScore = budgetScore + healthScore + timeScore + complexityScore + preferenceScore;

  return {
    score: Math.round(totalScore),
    scoreBreakdown: {
      budget: Math.round(budgetScore),
      health: Math.round(healthScore),
      time: Math.round(timeScore),
      complexity: Math.round(complexityScore),
      preference: Math.round(preferenceScore)
    }
  };
}