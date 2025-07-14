import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { templateHtml } from './template.ts';

// --- (All your interfaces, CORS headers, and the generateHtml function are correct and do not need changes ) ---
interface Recipe {
  title: string;
  ingredients?: string;
  recipe?: string;
  calories?: number;
}
interface MealDay {
  day: string;
  main_dish: Recipe;
  side_dish: Recipe | null;
}
interface ShoppingList {
  [category: string]: string[];
}
interface RequestBody {
  type: 'full' | 'shopping';
  meals: MealDay[];
  shoppingList: ShoppingList;
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function fillHtmlTemplate(template: string, data: RequestBody): string {
    let finalHtml = template;

    if (data.type === 'shopping') {
        const shoppingListHtml = Object.entries(data.shoppingList ?? {})
            .map(([category, items]) => `
                <h2>${category}</h2>
                <ul>
                    ${(items ?? []).map(item => `<li>${item}</li>`).join('')}
                </ul>
            `).join('');
        finalHtml = finalHtml.replace('{{SHOPPING_LIST}}', shoppingListHtml).replace('{{MEAL_CARDS}}', '');
    } else {
        const mealCardsHtml = (data.meals ?? []).map(meal => {
            const ingredients = `${meal.main_dish?.ingredients || ''}\n${meal.side_dish?.ingredients || ''}`
                .split('\n').map(i => i.trim().replace(/^- ?/, '')).filter(Boolean).map(i => `<li>${i}</li>`).join('');
            
            const recipe = `${meal.main_dish?.recipe || ''}\n${meal.side_dish?.recipe || ''}`
                .split('\n').map(r => r.trim().replace(/^\d+\.? ?/, '')).filter(Boolean).map(r => `<li>${r}</li>`).join('');

            return `
              <div class="meal-card">
                <h1>${meal.day}: ${meal.main_dish.title}</h1>
                <h3>Ingredients</h3>
                <ul>${ingredients}</ul>
                <h3>Recipe</h3>
                <ol>${recipe}</ol>
              </div>
            `;
        }).join('');
        finalHtml = finalHtml.replace('{{MEAL_CARDS}}', mealCardsHtml).replace('{{SHOPPING_LIST}}', '');
    }
    
    return finalHtml;
}

// --- Main Server Function ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('PDF_SHIFT_API_KEY');
    if (!apiKey) {
      throw new Error('PDF_SHIFT_API_KEY not found in environment variables.');
    }

    const requestBody: RequestBody = await req.json();
    const finalHtml = fillHtmlTemplate(templateHtml, requestBody);
    
    const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        // =================================================================
        // --- FINAL FIX: Format the API key correctly before encoding ---
        // Prepend "api:" to the key as required by PDF-Shift.
        // =================================================================
        'Authorization': `Basic ${encode(`api:${apiKey}` )}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: finalHtml,
        sandbox: false 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDF-Shift API Error:', errorText);
      throw new Error(`Failed to generate PDF: ${errorText}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      status: 200,
    });

  } catch (e) {
    const error = e as Error;
    console.error("--- ERROR IN EDGE FUNCTION ---", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});







