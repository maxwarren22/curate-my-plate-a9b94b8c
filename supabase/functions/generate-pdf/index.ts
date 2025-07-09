import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipe {
  id: string;
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
}

interface MealHistoryWithRecipe {
  meal_date: string;
  recipes: Recipe;
}

function generateHtml(meals: MealHistoryWithRecipe[], shoppingList: string, type: 'full' | 'shopping') {
  const firstDate = new Date(meals[0]?.meal_date || new Date());
  const weekStart = firstDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  if (type === 'shopping') {
    const shoppingListItems = shoppingList?.split('\\n').map((item: string) => `<li>${item.replace(/-\s*/, '')}</li>`).join('') || '';
    return `
      <html>
        <head><style>body { font-family: sans-serif; } h1 { color: #4A5D23; }</style></head>
        <body>
          <h1>Shopping List for week of ${weekStart}</h1>
          <ul>${shoppingListItems}</ul>
        </body>
      </html>
    `;
  }

  const mealCards = meals.map((meal: MealHistoryWithRecipe) => {
    const dayName = new Date(meal.meal_date).toLocaleDateString('en-US', { weekday: 'long' });
    const ingredients = meal.recipes.ingredients?.split('\\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    const recipe = meal.recipes.recipe?.split('\\n').map((s: string) => `<li>${s.replace(/\d+\.\s*/, '')}</li>`).join('') || '';

    return `
      <div style="margin-bottom: 2rem; page-break-inside: avoid;">
        <h2 style="color: #4A5D23; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${dayName}: ${meal.recipes.title}</h2>
        <p><strong>Calories:</strong> ${meal.recipes.calories}</p>
        <h3 style="margin-top: 1rem;">Ingredients</h3>
        <ul>${ingredients}</ul>
        <h3 style="margin-top: 1rem;">Recipe</h3>
        <ol>${recipe}</ol>
      </div>
    `;
  }).join('');

  return `
    <html>
      <head><style>body { font-family: sans-serif; line-height: 1.6; } h1, h2, h3 { color: #4A5D23; }</style></head>
      <body>
        <h1>Your Meal Plan for the week of ${weekStart}</h1>
        ${mealCards}
      </body>
    </html>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error("User not authenticated");

    const { type } = await req.json();
    if (type !== 'full' && type !== 'shopping') {
      throw new Error("Invalid PDF type specified.");
    }

    // Get current week's meals from user_meal_history
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(today.setDate(diff));
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const { data: meals, error: mealsError } = await supabaseClient
      .from('user_meal_history')
      .select(`
        meal_date,
        recipes (
          id,
          title,
          ingredients,
          recipe,
          calories
        )
      `)
      .eq('user_id', user.id)
      .gte('meal_date', weekStartDate.toISOString().split('T')[0])
      .lte('meal_date', weekEndDate.toISOString().split('T')[0])
      .order('meal_date');

    if (mealsError) {
      throw mealsError;
    }

    if (!meals || meals.length === 0) {
      throw new Error("No meals found for this week. Please generate a meal plan first.");
    }

    // Generate shopping list from all ingredients
    const allIngredients = meals.map((meal: any) => meal.recipes.ingredients).join('\\n');
    
    const htmlContent = generateHtml(meals as MealHistoryWithRecipe[], allIngredients, type);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return new Response(pdfBuffer, {
      headers: { ...corsHeaders, "Content-Type": "application/pdf" },
      status: 200,
    });

  } catch (error) {
    // --- THIS IS THE FIX ---
    // Check if the caught error is an instance of Error before accessing .message
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return new Response(JSON.stringify({ error: errorMessage }), {
    // --- END OF FIX ---
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
