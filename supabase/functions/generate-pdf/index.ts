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

interface MealDay {
  day: string;
  main_dish: Recipe;
  side_dish: Recipe;
  total_time_to_cook: string;
  cooking_tips?: string;
}

function generateHtml(meals: MealDay[], shoppingList: Record<string, string[]>, type: 'full' | 'shopping') {
  const firstDate = new Date();
  const weekStart = firstDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  if (type === 'shopping') {
    const shoppingListItems = Object.entries(shoppingList).map(([category, items]) => `
        <div style="margin-bottom: 1rem; page-break-inside: avoid;">
            <h2 style="color: #4A5D23; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${category}</h2>
            <ul style="list-style-type: none; padding-left: 0;">
                ${items.map((item: string) => `<li>- ${item}</li>`).join('')}
            </ul>
        </div>
    `).join('');
    return `
      <html>
        <head><style>body { font-family: sans-serif; } h1, h2 { color: #4A5D23; }</style></head>
        <body>
          <h1>Shopping List for week of ${weekStart}</h1>
          ${shoppingListItems}
        </body>
      </html>
    `;
  }

  const mealCards = meals.map((meal: MealDay) => {
    const dayName = meal.day;
    const ingredients = meal.main_dish.ingredients?.split('\\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    const recipe = meal.main_dish.recipe?.split('\\n').map((s: string) => `<li>${s.replace(/\d+\.\s*/, '')}</li>`).join('') || '';
    
    const sideIngredients = meal.side_dish.ingredients?.split('\\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    const sideRecipe = meal.side_dish.recipe?.split('\\n').map((s: string) => `<li>${s.replace(/\d+\.\s*/, '')}</li>`).join('') || '';

    return `
      <div style="margin-bottom: 2rem; page-break-inside: avoid;">
        <h2 style="color: #4A5D23; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${dayName}: ${meal.main_dish.title}</h2>
        <p><strong>Calories:</strong> ${meal.main_dish.calories}</p>
        <h3 style="margin-top: 1rem;">Ingredients</h3>
        <ul>${ingredients}</ul>
        <h3 style="margin-top: 1rem;">Recipe</h3>
        <ol>${recipe}</ol>
        
        <h2 style="color: #4A5D23; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 2rem;">Side: ${meal.side_dish.title}</h2>
        <p><strong>Calories:</strong> ${meal.side_dish.calories}</p>
        <h3 style="margin-top: 1rem;">Ingredients</h3>
        <ul>${sideIngredients}</ul>
        <h3 style="margin-top: 1rem;">Recipe</h3>
        <ol>${sideRecipe}</ol>
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

    const { type, meals, shoppingList } = await req.json();
    if (type !== 'full' && type !== 'shopping') {
      throw new Error("Invalid PDF type specified.");
    }
    
    const htmlContent = generateHtml(meals, shoppingList, type);

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
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});