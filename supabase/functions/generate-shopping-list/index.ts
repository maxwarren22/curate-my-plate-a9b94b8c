import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients, pantryItems } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `
      You are a shopping list expert. Given a list of ingredients for a weekly meal plan and a list of items already in the user's pantry, create a categorized shopping list.

      Meal Plan Ingredients:
      ${ingredients.join('\n')}

      Pantry Items (to exclude from shopping list):
      ${pantryItems.map((item: any) => item.ingredient_name).join(', ')}

      Generate a categorized shopping list. The categories should be:
      - Produce
      - Meat & Seafood
      - Dairy & Eggs
      - Grains & Bakery
      - Canned/Packaged
      - Pantry Staples
      - Other

      For each item in the shopping list, provide the following JSON structure:
      {
        "name": "Ingredient Name",
        "quantity": "e.g., 1 cup, 2 lbs, 1 container",
        "category": "One of the categories listed above",
        "estimatedPrice": A number (e.g., 2.50)
      }
      
      Return ONLY a single JSON object with two keys:
      1. "ingredients": an array of the ingredient objects.
      2. "categorizedList": an object where keys are the categories and values are arrays of ingredient strings (e.g., "1 cup flour").
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const shoppingList = JSON.parse(cleanContent);

    // Save the generated shopping list to the database
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay() + 1);

    await supabase.from('shopping_lists').upsert({
      user_id: user.id,
      week_start_date: weekStartDate.toISOString().split('T')[0],
      shopping_list: shoppingList.categorizedList,
      ai_processed_ingredients: shoppingList.ingredients,
    }, { onConflict: 'user_id,week_start_date' });


    return new Response(JSON.stringify(shoppingList), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-shopping-list function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});