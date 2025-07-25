import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MealConcept {
  day: string;
  main_dish_concept: string;
  side_dish_concept?: string;
  cuisine: string;
  diet_restrictions?: string[];
}

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  analyzedInstructions: any[];
  extendedIngredients: any[];
  nutrition?: any;
  pricePerServing?: number;
  healthScore?: number;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const spoonacularApiKey = Deno.env.get('SPOONACULAR_API_KEY');

console.log('Environment check:', {
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseServiceKey,
  hasOpenAI: !!openAIApiKey,
  hasSpoonacular: !!spoonacularApiKey,
  spoonacularKeyLength: spoonacularApiKey?.length || 0
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('=== MEAL PLAN GENERATION START ===');
  console.log('Environment check:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    hasOpenAI: !!openAIApiKey,
    hasSpoonacular: !!spoonacularApiKey,
    spoonacularKeyLength: spoonacularApiKey?.length || 0
  });
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting meal plan generation for user:', user.id);
    console.log('API Keys available:', { 
      openAI: !!openAIApiKey, 
      spoonacular: !!spoonacularApiKey,
      spoonacularLength: spoonacularApiKey?.length || 0 
    });

    // Get user profile for preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      console.error('No profile found for user');
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get pantry items and disliked ingredients
    const [pantryResponse, dislikesResponse] = await Promise.all([
      supabase.from('pantry_items').select('ingredient_name').eq('user_id', user.id),
      supabase.from('disliked_ingredients').select('ingredient_name').eq('user_id', user.id)
    ]);

    const pantryItems = pantryResponse.data?.map(item => item.ingredient_name) || [];
    const dislikedIngredients = dislikesResponse.data?.map(item => item.ingredient_name) || [];

    console.log('User preferences loaded:', { 
      pantryItems: pantryItems.length, 
      dislikedIngredients: dislikedIngredients.length 
    });

    // Step 1: Generate meal concepts with AI
    const mealConcepts = await generateMealConcepts(profile, pantryItems, dislikedIngredients);
    console.log('Generated meal concepts:', mealConcepts.length);

    // Step 2: Search Spoonacular for matching recipes
    const spoonacularMatches = await findSpoonacularMatches(mealConcepts, profile, dislikedIngredients);
    console.log('Found Spoonacular matches:', spoonacularMatches.length);

    // Step 3: Fill gaps with AI-generated recipes
    const completeMealPlan = await fillMealPlanGaps(mealConcepts, spoonacularMatches, profile, pantryItems, dislikedIngredients);
    console.log('Complete meal plan generated with', completeMealPlan.length, 'days');

    // Step 4: Save meal plan to database
    await saveMealPlanToDatabase(user.id, completeMealPlan);

    // Step 5: Generate and save shopping list
    await generateAndSaveShoppingList(user.id, completeMealPlan, pantryItems);

    console.log('Meal plan generation completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Meal plan generated successfully',
      mealPlan: completeMealPlan
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meal-plan function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateMealConcepts(profile: any, pantryItems: string[], dislikedIngredients: string[]): Promise<MealConcept[]> {
  console.log('=== GENERATING MEAL CONCEPTS ===');
  console.log('OpenAI API Key available:', !!openAIApiKey);
  
  if (!openAIApiKey) {
    console.log('No OpenAI API key, using fallback meal concepts');
    return getFallbackMealConcepts();
  }

  const prompt = `Generate 7 days of meal concepts based on these preferences:
- Cuisine preferences: ${profile.cuisine_preferences?.join(', ') || 'any'}
- Dietary restrictions: ${profile.dietary_restrictions?.join(', ') || 'none'}
- Cooking time: ${profile.cooking_time || '30 minutes'}
- Budget: ${profile.budget || 'moderate'}
- Health goals: ${profile.health_goals || 'balanced'}
- Available ingredients: ${pantryItems.slice(0, 10).join(', ')}
- Avoid these ingredients: ${dislikedIngredients.join(', ')}

Return ONLY a JSON array with 7 objects, each containing:
{
  "day": "Monday/Tuesday/etc",
  "main_dish_concept": "brief description of main dish",
  "side_dish_concept": "brief description of side dish (optional)",
  "cuisine": "cuisine type",
  "diet_restrictions": ["any dietary restrictions"]
}`;

  try {
    console.log('Calling OpenAI for meal concepts...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    console.log('OpenAI response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Clean the JSON response
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const concepts = JSON.parse(cleanContent);
    console.log('Generated meal concepts:', concepts.length);
    return concepts;
  } catch (error) {
    console.error('Error generating meal concepts:', error);
    console.log('Falling back to default concepts');
    return getFallbackMealConcepts();
  }
}

async function findSpoonacularMatches(concepts: MealConcept[], profile: any, dislikedIngredients: string[]): Promise<{ concept: MealConcept, recipe: SpoonacularRecipe, isMainDish: boolean }[]> {
  const matches: { concept: MealConcept, recipe: SpoonacularRecipe, isMainDish: boolean }[] = [];
  
  for (const concept of concepts) {
    // Search for main dish
    const mainDish = await searchSpoonacularRecipe(
      concept.main_dish_concept, 
      concept.cuisine, 
      profile.dietary_restrictions,
      dislikedIngredients
    );
    
    if (mainDish) {
      matches.push({ concept, recipe: mainDish, isMainDish: true });
    }

    // Search for side dish if specified
    if (concept.side_dish_concept) {
      const sideDish = await searchSpoonacularRecipe(
        concept.side_dish_concept, 
        concept.cuisine, 
        profile.dietary_restrictions,
        dislikedIngredients
      );
      
      if (sideDish) {
        matches.push({ concept, recipe: sideDish, isMainDish: false });
      }
    }
  }

  return matches;
}

async function searchSpoonacularRecipe(
  dishConcept: string, 
  cuisine: string, 
  dietaryRestrictions: string[] = [],
  dislikedIngredients: string[] = []
): Promise<SpoonacularRecipe | null> {
  try {
    if (!spoonacularApiKey) {
      console.log('❌ No Spoonacular API key available, skipping recipe search');
      return null;
    }

    console.log('🔍 Searching Spoonacular for:', dishConcept);
    
    const excludeIngredients = dislikedIngredients.join(',');
    const diet = dietaryRestrictions.length > 0 ? dietaryRestrictions[0] : '';
    
    const searchUrl = `https://api.spoonacular.com/recipes/complexSearch?` +
      `apiKey=${spoonacularApiKey}&` +
      `query=${encodeURIComponent(dishConcept)}&` +
      `cuisine=${encodeURIComponent(cuisine)}&` +
      `diet=${encodeURIComponent(diet)}&` +
      `excludeIngredients=${encodeURIComponent(excludeIngredients)}&` +
      `number=3&` +
      `addRecipeInformation=true&` +
      `addRecipeInstructions=true&` +
      `addRecipeNutrition=true`;

    console.log('🌐 Calling Spoonacular API...');
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('❌ Spoonacular API error:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    console.log('✅ Spoonacular response:', data.results?.length || 0, 'results for', dishConcept);

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.error('❌ Error searching Spoonacular:', error);
    return null;
  }
}

async function fillMealPlanGaps(
  concepts: MealConcept[], 
  spoonacularMatches: { concept: MealConcept, recipe: SpoonacularRecipe, isMainDish: boolean }[],
  profile: any,
  pantryItems: string[],
  dislikedIngredients: string[]
): Promise<any[]> {
  const mealPlan = [];

  for (const concept of concepts) {
    const mainMatch = spoonacularMatches.find(m => m.concept.day === concept.day && m.isMainDish);
    const sideMatch = spoonacularMatches.find(m => m.concept.day === concept.day && !m.isMainDish);

    let mainDish, sideDish;

    if (mainMatch) {
      // Use Spoonacular recipe
      mainDish = await convertSpoonacularToRecipe(mainMatch.recipe, true);
    } else {
      // Generate with AI
      mainDish = await generateAIRecipe(concept.main_dish_concept, concept, pantryItems, dislikedIngredients);
    }

    if (concept.side_dish_concept) {
      if (sideMatch) {
        sideDish = await convertSpoonacularToRecipe(sideMatch.recipe, false);
      } else {
        sideDish = await generateAIRecipe(concept.side_dish_concept, concept, pantryItems, dislikedIngredients);
      }
    }

    mealPlan.push({
      day: concept.day,
      main_dish: mainDish,
      side_dish: sideDish,
      total_time_to_cook: calculateTotalTime(mainDish, sideDish),
      cooking_tips: `${concept.cuisine} cuisine. ${mainDish.source_type === 'spoonacular' ? 'Recipe from Spoonacular.' : 'AI-generated recipe.'}`
    });
  }

  return mealPlan;
}

async function convertSpoonacularToRecipe(spoonacularRecipe: SpoonacularRecipe, isMainDish: boolean): Promise<any> {
  // Convert Spoonacular ingredients to string format
  const ingredients = spoonacularRecipe.extendedIngredients
    ?.map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
    .join('\n') || '';

  // Convert instructions to string format
  const instructions = spoonacularRecipe.analyzedInstructions?.[0]?.steps
    ?.map((step: any, index: number) => `${index + 1}. ${step.step}`)
    .join('\n') || '';

  const recipe = {
    id: crypto.randomUUID(),
    title: spoonacularRecipe.title,
    description: `Delicious ${spoonacularRecipe.title.toLowerCase()} recipe from Spoonacular.`,
    ingredients,
    recipe: instructions,
    calories: Math.round((spoonacularRecipe.nutrition?.nutrients?.find((n: any) => n.name === 'Calories')?.amount || 400) * (isMainDish ? 1 : 0.5)),
    servings: spoonacularRecipe.servings,
    spoonacular_id: spoonacularRecipe.id,
    image_url: spoonacularRecipe.image,
    source_url: spoonacularRecipe.sourceUrl,
    ready_in_minutes: spoonacularRecipe.readyInMinutes,
    health_score: spoonacularRecipe.healthScore,
    price_per_serving: spoonacularRecipe.pricePerServing,
    nutrition: spoonacularRecipe.nutrition,
    source_type: 'spoonacular' as const
  };

  return recipe;
}

async function generateAIRecipe(dishConcept: string, concept: MealConcept, pantryItems: string[], dislikedIngredients: string[]): Promise<any> {
  if (!openAIApiKey) {
    return getFallbackRecipe(dishConcept, concept);
  }

  const prompt = `Create a detailed recipe for: ${dishConcept}
Cuisine: ${concept.cuisine}
Diet restrictions: ${concept.diet_restrictions?.join(', ') || 'none'}
Try to use these available ingredients: ${pantryItems.slice(0, 5).join(', ')}
Avoid these ingredients: ${dislikedIngredients.join(', ')}

Return ONLY a JSON object with:
{
  "title": "Recipe name",
  "description": "Brief description",
  "ingredients": "Ingredient list as formatted string with quantities",
  "recipe": "Step-by-step instructions as formatted string",
  "calories": number (realistic estimate)
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const aiRecipe = JSON.parse(cleanContent);

    return {
      id: crypto.randomUUID(),
      source_type: 'ai' as const,
      ...aiRecipe
    };
  } catch (error) {
    console.error('Error generating AI recipe:', error);
    return getFallbackRecipe(dishConcept, concept);
  }
}

async function saveMealPlanToDatabase(userId: string, mealPlan: any[]): Promise<void> {
  // Save recipes first
  const recipesToSave = [];
  for (const day of mealPlan) {
    recipesToSave.push(day.main_dish);
    if (day.side_dish) {
      recipesToSave.push(day.side_dish);
    }
  }

  // Insert recipes
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
      spoonacular_id: recipe.spoonacular_id,
      image_url: recipe.image_url,
      source_url: recipe.source_url,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      ready_in_minutes: recipe.ready_in_minutes,
      health_score: recipe.health_score,
      price_per_serving: recipe.price_per_serving,
      nutrition: recipe.nutrition,
      source_type: recipe.source_type,
      created_by_user: userId
    })), { onConflict: 'id' });

  if (recipeError) {
    console.error('Error saving recipes:', recipeError);
    throw new Error('Failed to save recipes');
  }

  // Save meal history
  const mealHistoryData = mealPlan.map((day, index) => {
    const mealDate = new Date();
    mealDate.setDate(mealDate.getDate() + index);
    
    return {
      user_id: userId,
      meal_date: mealDate.toISOString().split('T')[0],
      main_dish_recipe_id: day.main_dish.id,
      side_dish_recipe_id: day.side_dish?.id || null,
      total_time_to_cook: day.total_time_to_cook,
      cooking_tips: day.cooking_tips
    };
  });

  const { error: historyError } = await supabase
    .from('user_meal_history')
    .upsert(mealHistoryData, { onConflict: 'user_id,meal_date' });

  if (historyError) {
    console.error('Error saving meal history:', historyError);
    throw new Error('Failed to save meal history');
  }

  console.log('Successfully saved meal plan to database');
}

async function generateAndSaveShoppingList(userId: string, mealPlan: any[], pantryItems: string[]): Promise<void> {
  console.log('🛒 === SHOPPING LIST GENERATION START ===');
  console.log('Meal plan length:', mealPlan.length);
  
  // Collect all ingredients from the meal plan
  const allIngredients: string[] = [];
  
  for (const day of mealPlan) {
    console.log('Processing day:', day.day);
    console.log('Main dish:', day.main_dish?.title, 'has ingredients:', !!day.main_dish?.ingredients);
    console.log('Side dish:', day.side_dish?.title, 'has ingredients:', !!day.side_dish?.ingredients);
    
    if (day.main_dish?.ingredients) {
      allIngredients.push(day.main_dish.ingredients);
      console.log('✅ Added main dish ingredients');
    } else {
      console.log('❌ No main dish ingredients found');
    }
    
    if (day.side_dish?.ingredients) {
      allIngredients.push(day.side_dish.ingredients);
      console.log('✅ Added side dish ingredients');
    } else {
      console.log('❌ No side dish ingredients found');
    }
  }

  console.log('🧾 Collected ingredients for shopping list:', allIngredients.length, 'ingredient blocks');

  if (allIngredients.length === 0) {
    console.log('❌ No ingredients found, creating empty shopping list');
    const { error: shoppingError } = await supabase
      .from('shopping_lists')
      .upsert({
        user_id: userId,
        week_start_date: getWeekStartDate(),
        shopping_list: [],
        ai_processed_ingredients: { ingredients: [], totalEstimatedCost: 0 }
      }, { onConflict: 'user_id,week_start_date' });

    if (shoppingError) {
      console.error('Error saving empty shopping list:', shoppingError);
    }
    return;
  }

  // Get pantry items in the expected format
  const { data: pantryData } = await supabase
    .from('pantry_items')
    .select('ingredient_name, quantity')
    .eq('user_id', userId);

  const pantryItemsFormatted = pantryData?.map(item => ({
    ingredient_name: item.ingredient_name,
    quantity: item.quantity || '1'
  })) || [];

  // Call the process-shopping-list function
  try {
    const { data: processedList, error: processError } = await supabase.functions.invoke('process-shopping-list', {
      body: {
        ingredients: allIngredients,
        pantryItems: pantryItemsFormatted
      }
    });

    if (processError) {
      throw new Error(`Process shopping list error: ${processError.message}`);
    }

    console.log('Successfully processed shopping list with', processedList?.ingredients?.length || 0, 'ingredients');

    // Save shopping list
    const { error: shoppingError } = await supabase
      .from('shopping_lists')
      .upsert({
        user_id: userId,
        week_start_date: getWeekStartDate(),
        shopping_list: allIngredients,
        ai_processed_ingredients: processedList
      }, { onConflict: 'user_id,week_start_date' });

    if (shoppingError) {
      console.error('Error saving shopping list:', shoppingError);
      throw new Error('Failed to save shopping list');
    }

    console.log('Successfully saved shopping list to database');

  } catch (error) {
    console.error('Error processing shopping list:', error);
    // Fallback to simple processing if the function call fails
    const processedIngredients = processIngredientsForShopping(allIngredients.join('\n').split('\n'), pantryItems);
    
    const { error: shoppingError } = await supabase
      .from('shopping_lists')
      .upsert({
        user_id: userId,
        week_start_date: getWeekStartDate(),
        shopping_list: allIngredients,
        ai_processed_ingredients: processedIngredients
      }, { onConflict: 'user_id,week_start_date' });

    if (shoppingError) {
      console.error('Error saving fallback shopping list:', shoppingError);
      throw new Error('Failed to save shopping list');
    }

    console.log('Saved fallback shopping list to database');
  }
}

function getWeekStartDate(): string {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return monday.toISOString().split('T')[0];
}

function processIngredientsForShopping(ingredients: string[], pantryItems: string[]): any {
  const categories = {
    'Produce': [],
    'Meat & Seafood': [],
    'Dairy & Eggs': [],
    'Grains & Bakery': [],
    'Pantry Staples': [],
    'Other': []
  };

  // Simple categorization logic
  for (const ingredient of ingredients) {
    const lower = ingredient.toLowerCase();
    const needed = !pantryItems.some(pantry => 
      lower.includes(pantry.toLowerCase()) || pantry.toLowerCase().includes(lower)
    );

    if (!needed) continue;

    let category = 'Other';
    if (lower.includes('meat') || lower.includes('chicken') || lower.includes('beef') || lower.includes('fish') || lower.includes('shrimp')) {
      category = 'Meat & Seafood';
    } else if (lower.includes('milk') || lower.includes('cheese') || lower.includes('egg') || lower.includes('butter') || lower.includes('cream')) {
      category = 'Dairy & Eggs';
    } else if (lower.includes('bread') || lower.includes('pasta') || lower.includes('rice') || lower.includes('flour') || lower.includes('cereal')) {
      category = 'Grains & Bakery';
    } else if (lower.includes('tomato') || lower.includes('onion') || lower.includes('garlic') || lower.includes('lettuce') || lower.includes('carrot') || lower.includes('potato')) {
      category = 'Produce';
    } else if (lower.includes('oil') || lower.includes('salt') || lower.includes('pepper') || lower.includes('spice') || lower.includes('sauce')) {
      category = 'Pantry Staples';
    }

    categories[category].push({
      name: ingredient,
      quantity: '1',
      category,
      estimatedPrice: 2.50
    });
  }

  return {
    ingredients: Object.values(categories).flat(),
    totalEstimatedCost: Object.values(categories).flat().length * 2.50
  };
}

function calculateTotalTime(mainDish: any, sideDish?: any): string {
  const mainTime = mainDish?.ready_in_minutes || 30;
  const sideTime = sideDish?.ready_in_minutes || 15;
  const totalMinutes = Math.max(mainTime, sideTime);
  return `${totalMinutes} minutes`;
}

function getFallbackMealConcepts(): MealConcept[] {
  return [
    { day: "Monday", main_dish_concept: "grilled chicken with herbs", side_dish_concept: "roasted vegetables", cuisine: "Mediterranean" },
    { day: "Tuesday", main_dish_concept: "pasta with marinara sauce", side_dish_concept: "garlic bread", cuisine: "Italian" },
    { day: "Wednesday", main_dish_concept: "stir-fry with vegetables", side_dish_concept: "steamed rice", cuisine: "Asian" },
    { day: "Thursday", main_dish_concept: "baked salmon", side_dish_concept: "quinoa salad", cuisine: "American" },
    { day: "Friday", main_dish_concept: "beef tacos", side_dish_concept: "guacamole", cuisine: "Mexican" },
    { day: "Saturday", main_dish_concept: "vegetable curry", side_dish_concept: "naan bread", cuisine: "Indian" },
    { day: "Sunday", main_dish_concept: "roast beef", side_dish_concept: "mashed potatoes", cuisine: "American" }
  ];
}

function getFallbackRecipe(dishConcept: string, concept: MealConcept): any {
  return {
    id: crypto.randomUUID(),
    title: dishConcept,
    description: `A delicious ${dishConcept.toLowerCase()} recipe.`,
    ingredients: "2 cups main ingredient\n1 cup vegetables\nSeasonings to taste",
    recipe: "1. Prepare ingredients\n2. Cook according to preference\n3. Season and serve",
    calories: 400,
    source_type: 'ai' as const
  };
}