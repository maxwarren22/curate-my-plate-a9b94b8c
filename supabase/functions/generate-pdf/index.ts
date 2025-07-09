import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Meal {
  title: string;
  ingredients: string;
  recipe: string;
}

interface MealDay {
  day: string;
  main_dish: Meal;
  side_dish: Meal;
}

interface PlanData {
  shopping_list?: string;
  meal_plan: MealDay[];
}

interface MealPlan {
  week_start_date: string;
  plan_data: PlanData;
}

function generateHtml(plan: MealPlan, type: 'full' | 'shopping') {
  const weekStart = new Date(plan.week_start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  if (type === 'shopping') {
    const shoppingListItems = plan.plan_data.shopping_list?.split('\\n').map((item: string) => `<li>${item.replace(/-\s*/, '')}</li>`).join('') || '';
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

  const mealCards = plan.plan_data.meal_plan.map((mealDay: MealDay) => {
    const mainIngredients = mealDay.main_dish.ingredients?.split('\\n').map((i: string) => `<li>${i.replace(/-\s*/, '')}</li>`).join('') || '';
    const mainRecipe = mealDay.main_dish.recipe?.split('\\n').map((s: string) => `<li>${s.replace(/\d+\.\s*/, '')}</li>`).join('') || '';

    return `
      <div style="margin-bottom: 2rem; page-break-inside: avoid;">
        <h2 style="color: #4A5D23; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${mealDay.day}: ${mealDay.main_dish.title}</h2>
        <p><em>with ${mealDay.side_dish.title}</em></p>
        <h3 style="margin-top: 1rem;">Ingredients</h3>
        <ul>${mainIngredients}</ul>
        <h3 style="margin-top: 1rem;">Recipe</h3>
        <ol>${mainRecipe}</ol>
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
    
    const { data: mealPlan, error: planError } = await supabaseClient
      .from('meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (planError || !mealPlan) {
      throw new Error("No meal plan found for this user.");
    }
    
    const htmlContent = generateHtml(mealPlan as MealPlan, type);

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
