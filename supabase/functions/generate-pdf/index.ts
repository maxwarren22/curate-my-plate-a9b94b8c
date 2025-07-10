import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { parseIngredient } from "https://esm.sh/parse-ingredient@0.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface for a single recipe
interface Recipe {
  id: string;
  title: string;
  ingredients: string;
  recipe: string;
  calories: number;
}

// --- FIX: Create a type that matches the raw data from Supabase ---
interface MealHistoryData {
  meal_date: string;
  total_time_to_cook: string;
  main_dish: Recipe[]; // Supabase returns relations as arrays
  side_dish: Recipe[]; // Supabase returns relations as arrays
}

// Interface for the clean data structure we want to use
interface Meal {
  meal_date: string;
  total_time_to_cook: string;
  main_dish: Recipe;
  side_dish: Recipe;
}

function generateHtml(meals: Meal[], shoppingList: string, type: 'full' | 'shopping') {
  const firstDate = new Date(meals[0]?.meal_date || new Date());
  const weekStart = firstDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  if (type === 'shopping') {
    const shoppingListItems = shoppingList.split('\n').map((item: string) => `<li>${item}</li>`).join('') || '';
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

  const mealCards = meals.map((meal) => {
    const dayName = new Date(meal.meal_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const mainIngredients = meal.main_dish.ingredients?.split('\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    const sideIngredients = meal.side_dish.ingredients?.split('\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';

    return `
      <div style="margin-bottom: 2rem; page-break-inside: avoid;">
        <h2 style="color: #4A5D23; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${dayName}: ${meal.main_dish.title}</h2>
        <p><strong>Total Time:</strong> ${meal.total_time_to_cook}</p>
        <h4>Ingredients</h4>
        <ul>${mainIngredients}${sideIngredients}</ul>
      </div>
    `;
  }).join('');

  return `
    <html>
      <head><style>body { font-family: sans-serif; line-height: 1.6; } h1, h2, h4 { color: #4A5D23; }</style></head>
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
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error("User not authenticated");

    const { type } = await req.json();
    if (type !== 'full' && type !== 'shopping') {
      throw new Error("Invalid PDF type specified.");
    }

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(today.setDate(diff));
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const { data: mealHistory, error: mealsError } = await supabaseClient
      .from('user_meal_history')
      .select(`meal_date, total_time_to_cook, main_dish:main_dish_recipe_id(*), side_dish:side_dish_recipe_id(*)`)
      .eq('user_id', user.id)
      .gte('meal_date', weekStartDate.toISOString().split('T')[0])
      .lte('meal_date', weekEndDate.toISOString().split('T')[0]);

    if (mealsError) throw mealsError;
    if (!mealHistory || mealHistory.length === 0) throw new Error("No meals found for this week.");
    
    // --- FIX: Safely transform the data without using 'any' ---
    const mealHistoryData = mealHistory as MealHistoryData[];
    const meals: Meal[] = mealHistoryData.map(record => ({
      ...record,
      main_dish: record.main_dish[0],
      side_dish: record.side_dish[0],
    }));

    const allIngredientStrings = meals.flatMap((meal: Meal) => [
      ...(meal.main_dish.ingredients?.split('\n') || []),
      ...(meal.side_dish.ingredients?.split('\n') || [])
    ]).filter(s => s && s.trim() !== '');

    const parsedIngredients = allIngredientStrings.flatMap(ing => parseIngredient(ing));
    const aggregated = new Map();

    parsedIngredients.forEach(p => {
        if (!p.description) return;
        const key = `${p.description.toLowerCase()}|${p.unitOfMeasure?.toLowerCase() || ''}`;
        const existing = aggregated.get(key);
        if (existing) {
            existing.quantity += p.quantity || 0;
        } else {
            aggregated.set(key, { ...p });
        }
    });

    const shoppingList = Array.from(aggregated.values())
        .map(p => `${p.quantity || ''} ${p.unitOfMeasure || ''} ${p.description}`.trim().replace(/\s+/g, ' '))
        .join('\n');
    
    const htmlContent = generateHtml(meals, shoppingList, type);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return new Response(pdfBuffer, {
      headers: { ...corsHeaders, "Content-Type": "application/pdf" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});