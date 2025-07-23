import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseIngredient, Ingredient } from "npm:parse-ingredient";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Type Definitions ---
interface Profile {
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  cooking_time?: string;
  skill_level?: string;
  serving_size?: string;
  generations_remaining: number;
}

interface Recipe {
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
}

interface MealDay {
    day: string;
    main_dish: Recipe;
    side_dish: Recipe | null;
    total_time_to_cook: string;
    cooking_tips?: string;
}

interface AIResponse {
    meal_plan: MealDay[];
}

interface AggregatedIngredient {
    quantity: number;
    unitOfMeasure: string | null;
    description: string;
}

const log = (level: "INFO" | "ERROR", step: string, details: unknown = {}) => {
  console.log(`[${level}] [generate-meal-plan] ${step}`, JSON.stringify(details, null, 2));
};

const toSingular = (word: string): string => {
    if (word.endsWith('oes')) return word.slice(0, -2);
    if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
    if (word.endsWith('s') && word.length > 2 && word.toLowerCase() !== 'hummus') return word.slice(0, -1);
    return word;
};

const categorizeIngredient = (ingredientDescription: string): string => {
    const produce = ["vegetable", "fruit", "onion", "garlic", "potato", "carrot", "broccoli", "spinach", "lettuce", "tomato", "avocado", "lemon", "lime", "apple", "banana", "berry"];
    const dairy = ["milk", "cheese", "yogurt", "butter", "cream", "egg"];
    const meat = ["chicken", "beef", "pork", "lamb", "fish", "shrimp", "salmon", "tuna"];
    const pantry = ["flour", "sugar", "salt", "pepper", "oil", "vinegar", "pasta", "rice", "beans", "canned", "spice", "herb", "sauce", "bread", "cereal", "oats"];
    const desc = ingredientDescription.toLowerCase();

    if (produce.some(p => desc.includes(p))) return "Produce";
    if (dairy.some(d => desc.includes(d))) return "Dairy & Eggs";
    if (meat.some(m => desc.includes(m))) return "Meat & Seafood";
    if (pantry.some(p => desc.includes(p))) return "Pantry Staples";
    return "Miscellaneous";
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let userId: string | undefined;

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
    userId = authData.user.id;
    log("INFO", "User authenticated", { userId });

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single<Profile>();

    if (profileError) throw profileError;
    log("INFO", "Profile loaded successfully.");

    const prompt = `
      Create a 7-day dinner meal plan.
      **User Preferences:**
      - Dietary Restrictions: ${profile.dietary_restrictions?.join(', ') || 'None'}
      - Cuisine Preferences: ${profile.cuisine_preferences?.join(', ') || 'Any'}
      - Available Cooking Time: ${profile.cooking_time || 'Any'}
      - Skill Level: ${profile.skill_level || 'Beginner'}
      
      **Output Requirements:**
      - The output must be a single, minified, valid JSON object containing only the "meal_plan" array.
      - Each dish must have a list of ingredients formatted as a single string, with each ingredient prefixed by a hyphen and separated by a newline character (\\n).
      - Do NOT include a shopping list. It will be generated separately.
    `;

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured.");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You are a professional chef. Generate a valid JSON object based on the user's request." }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
        const errorBody = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorBody}`);
    }

    const openaiData = await openaiResponse.json();
    const planData: AIResponse = JSON.parse(openaiData.choices[0].message.content);
    log("INFO", "Successfully generated and parsed meal plan from AI.");

    const allRecipes = planData.meal_plan.flatMap(day => [day.main_dish, day.side_dish].filter((d): d is Recipe => d != null));
    const allIngredientStrings = allRecipes.flatMap(recipe => recipe.ingredients?.split('\n') || []).filter(s => s && s.trim() !== '');
    const parsedIngredients: Ingredient[] = allIngredientStrings.flatMap(ing => parseIngredient(ing.replace(/-\s*/, '')));
    const requiredMap = new Map<string, AggregatedIngredient>();

    parsedIngredients.forEach(p => {
        if (!p.description) return;
        const description = p.description.split(',')[0].trim().toLowerCase();
        const singularDescription = toSingular(description);
        const unit = p.unitOfMeasure?.toLowerCase() || '';
        const key = `${singularDescription}|${unit}`;
        const existing = requiredMap.get(key);
        if (existing) {
            existing.quantity += p.quantity || 1;
        } else {
            requiredMap.set(key, { quantity: p.quantity || 1, unitOfMeasure: p.unitOfMeasure || '', description: singularDescription });
        }
    });

    const shoppingList: Record<string, string[]> = {};
    for (const [_key, required] of requiredMap.entries()) { // Fixed: Changed 'key' to '_key'
        const category = categorizeIngredient(required.description);
        if (!shoppingList[category]) shoppingList[category] = [];
        const formattedQuantity = Number.isInteger(required.quantity) ? required.quantity : required.quantity.toFixed(2);
        shoppingList[category].push(`${formattedQuantity} ${required.unitOfMeasure || ''} ${required.description}`.trim().replace(/\s+/g, ' '));
    }
    log("INFO", "Shopping list generated successfully.");

    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay());
    const weekStartDateString = weekStartDate.toISOString().split('T')[0];
    
    await supabaseClient.from('shopping_lists').upsert({ 
        user_id: userId, 
        week_start_date: weekStartDateString,
        shopping_list: shoppingList 
    }, { onConflict: 'user_id, week_start_date' });
    
    for (const [index, meal] of planData.meal_plan.entries()) {
        const mealDate = new Date(weekStartDate);
        mealDate.setDate(weekStartDate.getDate() + index);
        const mealDateStr = mealDate.toISOString().split('T')[0];
    
        const mainDishRecipeId = await saveOrGetRecipe(supabaseClient, meal.main_dish, userId);
        const sideDishRecipeId = meal.side_dish ? await saveOrGetRecipe(supabaseClient, meal.side_dish, userId) : null;
    
        await supabaseClient.from('user_meal_history').upsert({
            user_id: userId,
            main_dish_recipe_id: mainDishRecipeId,
            side_dish_recipe_id: sideDishRecipeId,
            meal_date: mealDateStr,
        }, { onConflict: 'user_id, meal_date' });
    }
    log("INFO", "All meals and shopping list saved.");

    return new Response(JSON.stringify({ success: true, mealPlan: planData, shoppingList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    log("ERROR", "Top-level function error", { userId, error: errorMessage, stack: error instanceof Error ? error.stack : null });
    return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
    });
  }
});

async function saveOrGetRecipe(supabaseClient: SupabaseClient, dish: Recipe, userId: string): Promise<string> {
    const { data: existingRecipe } = await supabaseClient
        .from('recipes')
        .select('id')
        .eq('title', dish.title)
        .maybeSingle();

    if (existingRecipe) return existingRecipe.id;

    const { data: newRecipe, error: insertError } = await supabaseClient
        .from('recipes')
        .insert({ ...dish, created_by_user: userId })
        .select('id')
        .single();
        
    if (insertError) throw insertError;
    if (!newRecipe) throw new Error("Failed to create new recipe.");
  
    return newRecipe.id;
}