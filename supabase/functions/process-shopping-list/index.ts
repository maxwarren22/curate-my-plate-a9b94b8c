import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessedIngredient {
  name: string;
  quantity: string;
  category: string;
  estimatedPrice: number;
}

interface ShoppingListResponse {
  ingredients: ProcessedIngredient[];
  totalEstimatedCost: number;
  categorizedList: Record<string, ProcessedIngredient[]>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients, pantryItems = [] } = await req.json();
    
    if (!ingredients || ingredients.length === 0) {
      return new Response(JSON.stringify({ 
        ingredients: [], 
        totalEstimatedCost: 0, 
        categorizedList: {} 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Flatten all ingredients into a single string
    const allIngredients = ingredients.join('\n');
    const pantryList = pantryItems.map((item: any) => `${item.quantity || ''} ${item.ingredient_name}`.trim()).join(', ');

    const prompt = `You are a smart shopping list assistant. Please process this list of ingredients from multiple recipes and create a clean, aggregated shopping list.

Raw ingredients from recipes:
${allIngredients}

Items already in pantry (exclude these):
${pantryList}

Please:
1. Parse and normalize all ingredients
2. Aggregate quantities of the same items (e.g., "2 avocados" + "3 avocado" = "5 avocados")
3. Use proper plural/singular forms
4. Make vague items more specific (e.g., "1 cheese" → "8 oz cheddar cheese")
5. Convert weird formats to common vernacular (e.g., "1 Juice of 1 Lemon" → "1 lemon (for juice)")
6. Categorize into: Produce, Meat & Seafood, Dairy & Eggs, Grains & Bakery, Pantry Staples, Canned/Packaged, Other
7. Estimate realistic grocery store prices in USD
8. Exclude pantry items completely

Return a JSON object in this exact format:
{
  "ingredients": [
    {
      "name": "avocados",
      "quantity": "5",
      "category": "Produce", 
      "estimatedPrice": 7.50
    }
  ],
  "totalEstimatedCost": 85.25
}

Make sure quantities are reasonable, names are clear, and prices reflect typical US grocery store costs.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful grocery shopping assistant that creates clean, organized shopping lists.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid response format from OpenAI');
    }

    // Categorize ingredients
    const categorizedList: Record<string, ProcessedIngredient[]> = {};
    parsedResult.ingredients.forEach((ingredient: ProcessedIngredient) => {
      if (!categorizedList[ingredient.category]) {
        categorizedList[ingredient.category] = [];
      }
      categorizedList[ingredient.category].push(ingredient);
    });

    const result: ShoppingListResponse = {
      ingredients: parsedResult.ingredients,
      totalEstimatedCost: parsedResult.totalEstimatedCost,
      categorizedList
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-shopping-list function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      ingredients: [], 
      totalEstimatedCost: 0, 
      categorizedList: {} 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});