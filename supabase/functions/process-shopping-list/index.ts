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

// Fallback function for basic ingredient processing when OpenAI is not available
function createFallbackShoppingList(ingredients: string[], pantryItems: any[]): ShoppingListResponse {
  console.log('Using fallback shopping list processing');
  
  // Create pantry set for filtering
  const pantrySet = new Set(
    pantryItems.map(item => item.ingredient_name.toLowerCase().trim())
  );
  
  // Parse all ingredients
  const parsedIngredients: ProcessedIngredient[] = [];
  const seenIngredients = new Map<string, ProcessedIngredient>();
  
  ingredients.forEach(ingredientString => {
    const lines = ingredientString.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const cleanLine = line.replace(/^-\s*/, '').trim();
      if (!cleanLine) return;
      
      // Extract quantity and name
      const quantityMatch = cleanLine.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      let quantity = '1';
      let name = cleanLine;
      
      if (quantityMatch) {
        quantity = quantityMatch[1];
        name = quantityMatch[2];
      }
      
      // Skip if in pantry
      if (pantrySet.has(name.toLowerCase().trim())) {
        return;
      }
      
      // Basic categorization
      const category = categorizeIngredientBasic(name);
      const estimatedPrice = estimatePriceBasic(name, parseFloat(quantity));
      
      const key = name.toLowerCase().trim();
      if (seenIngredients.has(key)) {
        const existing = seenIngredients.get(key)!;
        existing.quantity = (parseFloat(existing.quantity) + parseFloat(quantity)).toString();
        existing.estimatedPrice += estimatedPrice;
      } else {
        seenIngredients.set(key, {
          name,
          quantity,
          category,
          estimatedPrice
        });
      }
    });
  });
  
  const allIngredients = Array.from(seenIngredients.values());
  const totalCost = allIngredients.reduce((sum, item) => sum + item.estimatedPrice, 0);
  
  // Group by category
  const categorizedList: Record<string, ProcessedIngredient[]> = {};
  allIngredients.forEach(ingredient => {
    if (!categorizedList[ingredient.category]) {
      categorizedList[ingredient.category] = [];
    }
    categorizedList[ingredient.category].push(ingredient);
  });
  
  return {
    ingredients: allIngredients,
    totalEstimatedCost: totalCost,
    categorizedList
  };
}

function categorizeIngredientBasic(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('pork') || 
      lowerName.includes('fish') || lowerName.includes('salmon') || lowerName.includes('shrimp') || 
      lowerName.includes('tuna')) {
    return 'Meat & Seafood';
  }
  
  if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('yogurt') || 
      lowerName.includes('butter') || lowerName.includes('cream') || lowerName.includes('egg')) {
    return 'Dairy & Eggs';
  }
  
  if (lowerName.includes('tomato') || lowerName.includes('onion') || lowerName.includes('avocado') || 
      lowerName.includes('garlic') || lowerName.includes('cucumber') || lowerName.includes('greens') || 
      lowerName.includes('fruits') || lowerName.includes('lime') || lowerName.includes('lemon')) {
    return 'Produce';
  }
  
  if (lowerName.includes('bread') || lowerName.includes('pasta') || lowerName.includes('rice') || 
      lowerName.includes('tortilla')) {
    return 'Grains & Bakery';
  }
  
  if (lowerName.includes('can') || lowerName.includes('beans') || lowerName.includes('broth')) {
    return 'Canned/Packaged';
  }
  
  if (lowerName.includes('oil') || lowerName.includes('salt') || lowerName.includes('pepper') || 
      lowerName.includes('seasoning') || lowerName.includes('mustard') || lowerName.includes('mayonnaise')) {
    return 'Pantry Staples';
  }
  
  return 'Other';
}

function estimatePriceBasic(name: string, quantity: number): number {
  const lowerName = name.toLowerCase();
  
  // Basic price estimation
  if (lowerName.includes('chicken') || lowerName.includes('salmon')) return quantity * 4.00;
  if (lowerName.includes('avocado')) return quantity * 1.50;
  if (lowerName.includes('onion')) return quantity * 0.75;
  if (lowerName.includes('bread')) return quantity * 2.50;
  if (lowerName.includes('cheese')) return quantity * 3.00;
  if (lowerName.includes('egg')) return quantity * 0.25;
  if (lowerName.includes('pasta')) return quantity * 1.50;
  if (lowerName.includes('rice')) return quantity * 2.00;
  
  // Default price
  return quantity * 2.00;
}

serve(async (req) => {
  console.log('process-shopping-list function called with method:', req.method);
  
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
      console.error('OpenAI API key not configured');
      // Fallback to basic parsing when no OpenAI key
      return new Response(JSON.stringify(createFallbackShoppingList(ingredients, pantryItems)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    
    // If OpenAI fails, fall back to basic processing
    try {
      console.log('OpenAI failed, falling back to basic processing');
      const { ingredients, pantryItems = [] } = await req.json();
      const fallbackResult = createFallbackShoppingList(ingredients, pantryItems);
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (fallbackError) {
      console.error('Fallback processing also failed:', fallbackError);
      return new Response(JSON.stringify({ 
        error: 'Shopping list processing failed',
        ingredients: [], 
        totalEstimatedCost: 0, 
        categorizedList: {} 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
});