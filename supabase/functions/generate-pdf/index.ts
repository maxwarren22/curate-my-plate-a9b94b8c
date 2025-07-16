import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { templateHtml } from './template.ts';

// --- Interfaces (no changes needed) ---
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
interface ShoppingListItem { // A more specific type for clarity
  category: string;
  items: string[];
}
interface RequestBody {
  type: 'full' | 'shopping';
  meals: MealDay[];
  shoppingList: ShoppingListItem[]; // The shoppingList is an array
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =================================================================
// --- THIS FUNCTION CONTAINS THE FIX ---
// =================================================================
function fillHtmlTemplate(template: string, data: RequestBody): string {
    let mealCardsHtml = '';
    let shoppingListHtml = '';

    // Check if shoppingList exists and is an array
    if (data.shoppingList && Array.isArray(data.shoppingList)) {
        // Now correctly iterate over the array of objects
        shoppingListHtml = `<h1>Shopping List</h1>` + data.shoppingList
            .map(section => `
                <h2>${section.category}</h2>
                <ul>
                    ${(section.items ?? []).map(item => `<li>${item}</li>`).join('')}
                </ul>
            `).join('');
    }

    if (data.meals && data.meals.length > 0) {
        mealCardsHtml = data.meals.map(meal => {
            const ingredients = `${meal.main_dish?.ingredients || ''}\n${meal.side_dish?.ingredients || ''}`
                .split('\n').map(i => i.trim().replace(/^- ?/, '')).filter(Boolean).map(i => `<li>${i}</li>`).join('');
            
            const recipe = `${meal.main_dish?.recipe || ''}\n${meal.side_dish?.recipe || ''}`
                .split('\n').map(r => r.trim().replace(/^\d+\.? ?/, '')).filter(Boolean).map(r => `<li>${r}</li>`).join('');

            return `
              <div class="meal-card">
                <div class="meal-card-header">
                  <h1>${meal.day}: ${meal.main_dish.title}</h1>
                </div>
                <h3>Ingredients</h3>
                <ul>${ingredients}</ul>
                <h3>Recipe</h3>
                <ol>${recipe}</ol>
              </div>
            `;
        }).join('');
    }
    
    if (data.type === 'shopping') {
        return template.replace('{{SHOPPING_LIST}}', shoppingListHtml).replace('{{MEAL_CARDS}}', '');
    }
    
    return template.replace('{{MEAL_CARDS}}', mealCardsHtml).replace('{{SHOPPING_LIST}}', shoppingListHtml);
}

// --- Main Server Function (No changes needed here) ---
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

    const pdfArrayBuffer = await response.arrayBuffer();
    const pdfBase64 = encode(pdfArrayBuffer);

    return new Response(JSON.stringify({ pdf: pdfBase64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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






