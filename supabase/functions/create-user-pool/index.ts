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

    // Score and filter recipes based on user preferences
    const scoredRecipes: ScoredRecipe[] = recipes
      .map(recipe => {
        // Check recipe status
        const isLiked = likedRecipeIds.has(recipe.id);
        const isDisliked = dislikedRecipeIds.has(recipe.id);
        
        // Check for disliked ingredients
        const hasDislikedIngredient = Array.from(dislikedIngredientNames).some(ingredient =>
          recipe.ingredients.toLowerCase().includes(ingredient)
        );
        
        // Calculate score (includes penalty for disliked recipes/ingredients)
        const scoreData = calculateRecipeScore(
          recipe, 
          profile as UserProfile, 
          isLiked, 
          isDisliked || hasDislikedIngredient
        );
        
        return {
          ...recipe,
          ...scoreData
        };
      })
      .filter(recipe => recipe.score > 0) // Remove recipes with negative scores
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

function calculateRecipeScore(recipe: Recipe, profile: UserProfile, isLiked: boolean, isDisliked: boolean) {
  // Immediately penalize disliked recipes
  if (isDisliked) {
    return {
      score: -100,
      scoreBreakdown: {
        budget: 0,
        health: 0,
        time: 0,
        complexity: 0,
        preference: -100
      }
    };
  }

  let score = 0;
  const scoreBreakdown = {
    budget: 0,
    health: 0,
    time: 0,
    complexity: 0,
    preference: 0
  };

  // Budget scoring (30% weight)
  if (recipe.price_per_serving && profile.budget) {
    const budgetMap: { [key: string]: number } = {
      'low': 3,
      'medium': 6,
      'high': 12
    };
    const maxBudget = budgetMap[profile.budget] || 6;
    if (recipe.price_per_serving <= maxBudget) {
      const budgetEfficiency = 1 - (recipe.price_per_serving / maxBudget);
      scoreBreakdown.budget = budgetEfficiency * 30;
    } else {
      scoreBreakdown.budget = 0; // Over budget
    }
  } else {
    scoreBreakdown.budget = 15; // Default if no price data
  }

  // Health goals scoring (25% weight)
  if (profile.health_goals && recipe.health_score) {
    let healthMultiplier = 1;
    
    // Adjust multiplier based on health goals
    switch (profile.health_goals) {
      case 'weight_loss':
        healthMultiplier = 1.5;
        // Bonus for lower calorie recipes
        if (recipe.calories && recipe.calories < 500) {
          healthMultiplier += 0.2;
        }
        break;
      case 'muscle_gain':
        healthMultiplier = 1.3;
        // Bonus for higher protein/calorie recipes
        if (recipe.calories && recipe.calories > 600) {
          healthMultiplier += 0.2;
        }
        break;
      case 'general_health':
        healthMultiplier = 1.2;
        break;
      default:
        healthMultiplier = 1;
    }
    
    scoreBreakdown.health = (recipe.health_score / 100) * 25 * healthMultiplier;
  } else {
    scoreBreakdown.health = 12.5; // Default health score
  }

  // Time scoring (20% weight)
  if (recipe.ready_in_minutes && profile.cooking_time) {
    const timeMap: { [key: string]: number } = {
      'quick': 30,
      'moderate': 60,
      'long': 120
    };
    const maxTime = timeMap[profile.cooking_time] || 60;
    
    if (recipe.ready_in_minutes <= maxTime) {
      const timeEfficiency = 1 - (recipe.ready_in_minutes / maxTime);
      scoreBreakdown.time = 10 + (timeEfficiency * 10); // Base 10 + efficiency bonus
    } else {
      scoreBreakdown.time = 0; // Recipe takes too long
    }
  } else {
    scoreBreakdown.time = 10; // Default time score
  }

  // Complexity/skill level scoring (15% weight)
  if (profile.skill_level && recipe.ready_in_minutes) {
    const ingredientCount = recipe.ingredients.split('\n').filter(i => i.trim()).length;
    const instructionSteps = recipe.recipe.split('\n').filter(i => i.trim()).length;
    
    // Determine complexity level
    let complexityLevel = 1; // Simple
    if (ingredientCount > 8 || instructionSteps > 6 || recipe.ready_in_minutes > 60) {
      complexityLevel = 2; // Medium
    }
    if (ingredientCount > 15 || instructionSteps > 10 || recipe.ready_in_minutes > 120) {
      complexityLevel = 3; // Complex
    }
    
    const skillMap: { [key: string]: { [key: number]: number } } = {
      'beginner': { 1: 15, 2: 10, 3: 5 },
      'intermediate': { 1: 12, 2: 15, 3: 12 },
      'advanced': { 1: 10, 2: 13, 3: 15 }
    };
    
    scoreBreakdown.complexity = skillMap[profile.skill_level]?.[complexityLevel] || 10;
  } else {
    scoreBreakdown.complexity = 10; // Default complexity score
  }

  // User preference scoring (10% weight + significant bonus)
  if (isLiked) {
    scoreBreakdown.preference = 50; // Major bonus for liked recipes
  } else {
    scoreBreakdown.preference = 10; // Base preference score
  }

  // Additional dietary restrictions bonus
  if (profile.dietary_restrictions && profile.dietary_restrictions.length > 0) {
    // This would require recipe tags/metadata from Spoonacular
    // For now, we'll add a small bonus if health score is high
    if (recipe.health_score && recipe.health_score > 70) {
      scoreBreakdown.health += 5;
    }
  }

  score = Object.values(scoreBreakdown).reduce((sum, val) => sum + val, 0);

  return {
    score: Math.round(score * 100) / 100,
    scoreBreakdown: {
      budget: Math.round(scoreBreakdown.budget * 100) / 100,
      health: Math.round(scoreBreakdown.health * 100) / 100,
      time: Math.round(scoreBreakdown.time * 100) / 100,
      complexity: Math.round(scoreBreakdown.complexity * 100) / 100,
      preference: Math.round(scoreBreakdown.preference * 100) / 100
    }
  };
}