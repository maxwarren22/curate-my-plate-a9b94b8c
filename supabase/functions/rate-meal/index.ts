import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (level: "INFO" | "ERROR", step: string, details: unknown = {}) => {
  console.log(`[${level}] [rate-meal] ${step}`, JSON.stringify(details));
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("INFO", "Rate meal function starting");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new Error("Missing or invalid Authorization header");
    }
    const token = authHeader.replace("Bearer ", "");

    const { data: authData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;
    if (!authData.user) throw new Error("User not authenticated.");

    const user = authData.user;
    log("INFO", "User authenticated", { userId: user.id });

    const { recipe_id, rating } = await req.json();

    if (!recipe_id || (rating !== 1 && rating !== -1)) {
      throw new Error("Invalid input: recipe_id is required and rating must be 1 (like) or -1 (dislike)");
    }

    log("INFO", "Rating meal", { recipeId: recipe_id, rating });

    const { data: mealHistory, error: findError } = await supabaseClient
      .from('user_meal_history')
      .select('id')
      .eq('user_id', user.id)
      .or(`main_dish_recipe_id.eq.${recipe_id},side_dish_recipe_id.eq.${recipe_id}`)
      .limit(1)
      .maybeSingle();

    if (findError) {
      log("ERROR", "Error finding meal history", findError);
      throw findError;
    }

    if (!mealHistory) {
      log("INFO", "No meal history found for this recipe. Rating not applied to a specific meal instance.");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Rating noted for future recommendations." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { error: updateError } = await supabaseClient
      .from('user_meal_history')
      .update({ rating })
      .eq('id', mealHistory.id);

    if (updateError) {
      log("ERROR", "Error updating rating", updateError);
      throw updateError;
    }

    log("INFO", "Rating updated successfully", { historyId: mealHistory.id, rating });

    return new Response(JSON.stringify({ 
      success: true, 
      message: rating === 1 ? "Recipe liked!" : "Recipe disliked!" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log("ERROR", "Top-level function error", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});