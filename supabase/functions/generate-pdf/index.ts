
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-PDF] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting PDF generation");

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

    // Get latest meal plan
    const { data: mealPlan, error: planError } = await supabaseClient
      .from('meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (planError || !mealPlan) {
      throw new Error("No meal plan found");
    }

    // Get shopping list
    const { data: shoppingList } = await supabaseClient
      .from('shopping_lists')
      .select('*')
      .eq('meal_plan_id', mealPlan.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    logStep("Data loaded", { planId: mealPlan.id, hasShoppingList: !!shoppingList });

    const meals = mealPlan.plan_data.meals;
    const weekStart = new Date(mealPlan.week_start_date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    };

    // Generate HTML for PDF
    const mealCards = Object.entries(meals).map(([day, meal]: [string, any]) => `
      <div class="meal-card">
        <h3>${day}</h3>
        <h4>${meal.name}</h4>
        <p class="description">${meal.description}</p>
        <div class="meta">
          <span>⏱️ ${meal.cookTime}</span>
          <span>📊 ${meal.nutrition.calories} cal</span>
          <span>👨‍🍳 ${meal.difficulty}</span>
        </div>
        <div class="ingredients">
          <h5>Ingredients:</h5>
          <ul>
            ${meal.ingredients.map((ing: string) => `<li>${ing}</li>`).join('')}
          </ul>
        </div>
        <div class="instructions">
          <h5>Instructions:</h5>
          <ol>
            ${meal.instructions.map((step: string) => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      </div>
    `).join('');

    let shoppingListHtml = '';
    if (shoppingList?.items) {
      const categories = Object.entries(shoppingList.items);
      shoppingListHtml = `
        <div class="page-break">
          <div class="shopping-header">
            <h2>🛒 Shopping List</h2>
            <p>Week of ${formatDate(weekStart)}</p>
          </div>
          ${categories.map(([category, items]: [string, any]) => {
            if (!Array.isArray(items) || items.length === 0) return '';
            return `
              <div class="shopping-category">
                <h3>${category}</h3>
                <ul class="shopping-items">
                  ${items.map(item => `<li><span class="checkbox">☐</span> ${item}</li>`).join('')}
                </ul>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Meal Plan - ${formatDate(weekStart)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Inter', Arial, sans-serif; 
            line-height: 1.4; 
            color: #333; 
            font-size: 12px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #4A5D23; 
            padding-bottom: 15px;
          }
          .header h1 { 
            color: #4A5D23; 
            font-size: 24px; 
            margin-bottom: 5px; 
          }
          .header p { 
            color: #666; 
            font-size: 14px; 
          }
          .meal-card { 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 15px; 
            margin-bottom: 15px; 
            background: #fafafa;
          }
          .meal-card h3 { 
            color: #4A5D23; 
            font-size: 16px; 
            margin-bottom: 5px; 
          }
          .meal-card h4 { 
            font-size: 14px; 
            margin-bottom: 8px; 
          }
          .description { 
            color: #666; 
            font-size: 11px; 
            margin-bottom: 10px; 
          }
          .meta { 
            display: flex; 
            gap: 10px; 
            margin-bottom: 12px; 
            font-size: 10px;
          }
          .meta span { 
            background: #E87461; 
            color: white; 
            padding: 3px 6px; 
            border-radius: 3px; 
          }
          .ingredients, .instructions { 
            margin-top: 10px; 
          }
          .ingredients h5, .instructions h5 { 
            color: #4A5D23; 
            font-size: 12px; 
            margin-bottom: 5px; 
          }
          .ingredients ul, .instructions ol { 
            margin-left: 15px; 
          }
          .ingredients li, .instructions li { 
            font-size: 10px; 
            margin-bottom: 3px; 
          }
          .page-break { 
            page-break-before: always; 
          }
          .shopping-header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #4A5D23; 
            padding-bottom: 15px;
          }
          .shopping-header h2 { 
            color: #4A5D23; 
            font-size: 20px; 
            margin-bottom: 5px; 
          }
          .shopping-category { 
            margin-bottom: 15px; 
          }
          .shopping-category h3 { 
            color: #4A5D23; 
            font-size: 14px; 
            margin-bottom: 8px; 
            border-bottom: 1px solid #ddd; 
            padding-bottom: 3px;
          }
          .shopping-items { 
            list-style: none; 
            margin-left: 0; 
          }
          .shopping-items li { 
            font-size: 11px; 
            margin-bottom: 5px; 
            display: flex; 
            align-items: center;
          }
          .checkbox { 
            margin-right: 8px; 
            font-size: 12px; 
          }
          @media print {
            body { font-size: 11px; }
            .meal-card { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍽️ Curate My Plate</h1>
          <p>Weekly Meal Plan - ${formatDate(weekStart)} to ${formatDate(weekEnd)}</p>
        </div>
        
        ${mealCards}
        ${shoppingListHtml}
      </body>
    </html>
    `;

    logStep("HTML generated, creating PDF");

    // For now, return the HTML content as the PDF generation would require additional dependencies
    // In a real implementation, you'd use a library like Puppeteer or similar
    return new Response(htmlContent, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="meal-plan-${mealPlan.week_start_date}.html"`
      },
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
