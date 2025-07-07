
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-MEAL-PLAN] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting meal plan generation");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) throw new Error("Could not load user profile");
    logStep("Profile loaded", { profile });

    // Get pantry items
    const { data: pantryItems } = await supabaseClient
      .from('pantry_items')
      .select('ingredient_name, quantity')
      .eq('user_id', user.id);

    // Get disliked ingredients
    const { data: dislikedIngredients } = await supabaseClient
      .from('disliked_ingredients')
      .select('ingredient_name')
      .eq('user_id', user.id);

    logStep("Pantry and dislikes loaded", { 
      pantryCount: pantryItems?.length || 0, 
      dislikesCount: dislikedIngredients?.length || 0 
    });

    // Create OpenAI prompt
    const prompt = `Generate a 7-day dinner meal plan based on these preferences:
    
Dietary Restrictions: ${profile.dietary_restrictions?.join(', ') || 'None'}
Cuisine Preferences: ${profile.cuisine_preferences?.join(', ') || 'Any'}
Cooking Time: ${profile.cooking_time || 'Any'}
Skill Level: ${profile.skill_level || 'Any'}
Serving Size: ${profile.serving_size || '2 people'}
Budget: ${profile.budget || 'Moderate'}

Available Pantry Items: ${pantryItems?.map(item => `${item.ingredient_name} (${item.quantity || 'some'})`).join(', ') || 'None'}

Ingredients to AVOID: ${dislikedIngredients?.map(item => item.ingredient_name).join(', ') || 'None'}

Please return a JSON object with this exact structure:
{
  "meals": {
    "Monday": {
      "name": "Recipe Name",
      "description": "Brief description",
      "cookTime": "X minutes",
      "difficulty": "Easy/Medium/Hard",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "instructions": ["step 1", "step 2"],
      "nutrition": {
        "calories": 400,
        "protein": "25g",
        "carbs": "30g",
        "fat": "15g"
      }
    },
    // ... repeat for Tuesday through Sunday
  }
}

Focus on variety, nutrition balance, and incorporating available pantry items where possible.`;

    logStep("Calling OpenAI API");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional chef and nutritionist. Generate healthy, practical meal plans in valid JSON format only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const mealPlanText = openaiData.choices[0].message.content;
    
    logStep("OpenAI response received");

    let mealPlanData;
    try {
      mealPlanData = JSON.parse(mealPlanText);
    } catch (parseError) {
      logStep("JSON parse error, trying to extract JSON from response");
      // Try to extract JSON from response if it's wrapped in other text
      const jsonMatch = mealPlanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        mealPlanData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse meal plan JSON");
      }
    }

    // Calculate week start date (current Monday)
    const today = new Date();
    const currentDay = today.getDay();
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() + daysToMonday);
    const weekStartStr = weekStartDate.toISOString().split('T')[0];

    // Save meal plan to database
    const { data: savedPlan, error: saveError } = await supabaseClient
      .from('meal_plans')
      .upsert({
        user_id: user.id,
        week_start_date: weekStartStr,
        plan_data: mealPlanData,
      }, { 
        onConflict: 'user_id,week_start_date',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (saveError) throw new Error(`Error saving meal plan: ${saveError.message}`);

    logStep("Meal plan saved", { planId: savedPlan.id });

    // Generate shopping list
    const allIngredients: string[] = [];
    Object.values(mealPlanData.meals).forEach((meal: any) => {
      if (meal.ingredients) {
        allIngredients.push(...meal.ingredients);
      }
    });

    // Remove pantry items from shopping list
    const pantryIngredientNames = (pantryItems || []).map(item => item.ingredient_name.toLowerCase());
    const shoppingIngredients = allIngredients.filter(ingredient => 
      !pantryIngredientNames.some(pantryItem => 
        ingredient.toLowerCase().includes(pantryItem)
      )
    );

    // Group and categorize shopping list
    const categorizedList = {
      "Produce": shoppingIngredients.filter(ing => 
        /tomato|onion|garlic|pepper|lettuce|spinach|carrot|potato|cucumber|herb|lemon|lime|apple|banana/i.test(ing)
      ),
      "Meat & Seafood": shoppingIngredients.filter(ing => 
        /chicken|beef|pork|fish|salmon|shrimp|turkey|bacon/i.test(ing)
      ),
      "Dairy & Eggs": shoppingIngredients.filter(ing => 
        /milk|cheese|butter|yogurt|cream|egg/i.test(ing)
      ),
      "Pantry": shoppingIngredients.filter(ing => 
        /rice|pasta|flour|oil|vinegar|sauce|spice|salt|pepper|sugar/i.test(ing)
      ),
      "Other": shoppingIngredients.filter(ing => 
        !/tomato|onion|garlic|pepper|lettuce|spinach|carrot|potato|cucumber|herb|lemon|lime|apple|banana|chicken|beef|pork|fish|salmon|shrimp|turkey|bacon|milk|cheese|butter|yogurt|cream|egg|rice|pasta|flour|oil|vinegar|sauce|spice|salt|pepper|sugar/i.test(ing)
      )
    };

    // Save shopping list
    const { error: shoppingError } = await supabaseClient
      .from('shopping_lists')
      .insert({
        user_id: user.id,
        meal_plan_id: savedPlan.id,
        items: categorizedList,
      });

    if (shoppingError) {
      logStep("Shopping list save error", shoppingError);
    } else {
      logStep("Shopping list saved");
    }

    return new Response(JSON.stringify({
      success: true,
      mealPlan: mealPlanData,
      weekStartDate: weekStartStr,
      planId: savedPlan.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
