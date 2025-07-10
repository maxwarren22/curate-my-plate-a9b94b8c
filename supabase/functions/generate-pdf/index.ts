import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { parseIngredient } from "https://esm.sh/parse-ingredient@0.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Type definitions
interface Recipe { id: string; title: string; ingredients: string; recipe: string; calories: number; }
interface MealHistoryData { meal_date: string; total_time_to_cook: string; main_dish: Recipe[]; side_dish: Recipe[]; }
interface Meal { meal_date: string; total_time_to_cook: string; main_dish: Recipe; side_dish: Recipe; }
interface AggregatedIngredient { quantity: number; unitOfMeasure: string; description: string; }

// --- FIX: Define the type for the object returned by the parseIngredient function ---
interface ParsedIngredient {
  quantity: number | null;
  unitOfMeasure: string | null;
  description: string;
}

function generateHtml(meals: Meal[], shoppingList: string, type: 'full' | 'shopping') {
  const firstDate = new Date(meals[0]?.meal_date || new Date());
  const weekStart = firstDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  if (type === 'shopping') {
    const shoppingListItems = shoppingList.split('\n').map((item: string) => `<li>${item}</li>`).join('');
    return `<html><head><style>body{font-family:sans-serif}h1{color:#4A5D23}</style></head><body><h1>Shopping List for week of ${weekStart}</h1><ul>${shoppingListItems}</ul></body></html>`;
  }

  const mealCards = meals.map((meal) => {
    const dayName = new Date(meal.meal_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const mainIngredients = meal.main_dish.ingredients?.split('\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    const sideIngredients = meal.side_dish.ingredients?.split('\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    return `<div style="page-break-inside: avoid;"><h2>${dayName}: ${meal.main_dish.title}</h2><p><strong>Total Time:</strong> ${meal.total_time_to_cook}</p><h4>Ingredients</h4><ul>${mainIngredients}${sideIngredients}</ul></div>`;
  }).join('');

  return `<html><head><style>body{font-family:sans-serif;line-height:1.6}h1,h2,h4{color:#4A5D23}</style></head><body><h1>Your Meal Plan for the week of ${weekStart}</h1>${mealCards}</body></html>`;
}

const toSingular = (word: string): string => {
  if (word.endsWith('s') && word.length > 2 && word !== 'hummus') return word.slice(0, -1);
  return word;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("User not authenticated");

    const { type } = await req.json();
    if (type !== 'full' && type !== 'shopping') throw new Error("Invalid PDF type specified.");

    const today = new Date();
    const weekStartDate = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
    const weekEndDate = new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 6));

    const { data: mealHistory, error: mealsError } = await supabaseClient
      .from('user_meal_history')
      .select(`meal_date, total_time_to_cook, main_dish:main_dish_recipe_id(*), side_dish:side_dish_recipe_id(*)`)
      .eq('user_id', user.id)
      .gte('meal_date', weekStartDate.toISOString().split('T')[0])
      .lte('meal_date', weekEndDate.toISOString().split('T')[0]);
      
    if (mealsError) throw mealsError;
    if (!mealHistory || mealHistory.length === 0) throw new Error("No meals found.");

    const meals: Meal[] = (mealHistory as MealHistoryData[]).map(r => ({ ...r, main_dish: r.main_dish[0], side_dish: r.side_dish[0] }));
    const allIngredientStrings = meals.flatMap(m => [...(m.main_dish.ingredients?.split('\n') || []), ...(m.side_dish.ingredients?.split('\n') || [])]).filter(Boolean);
    
    const parsedIngredients = allIngredientStrings.flatMap(ing => parseIngredient(ing));
    const aggregated = new Map<string, AggregatedIngredient>();

    parsedIngredients.forEach(p => {
        if (!p.description) return;
        const description = toSingular(p.description.split(',')[0].trim().toLowerCase());
        const unit = p.unitOfMeasure?.toLowerCase() || '';
        const key = `${description}|${unit}`;
        
        const existing = aggregated.get(key);
        if (existing) {
            existing.quantity += p.quantity || 1;
        } else {
            aggregated.set(key, { quantity: p.quantity || 1, unitOfMeasure: p.unitOfMeasure || '', description });
        }
    });

    const shoppingList = Array.from(aggregated.values())
        .map((p: AggregatedIngredient) => `${p.quantity || ''} ${p.unitOfMeasure || ''} ${p.description}`.trim().replace(/\s+/g, ' '))
        .join('\n');
    
    const htmlContent = generateHtml(meals, shoppingList, type);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return new Response(pdfBuffer, { headers: { ...corsHeaders, "Content-Type": "application/pdf" }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});