
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-WEEKLY-PLAN] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting weekly plan email");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("User not authenticated");

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's latest meal plan from user_meal_history
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(today.setDate(diff));
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const { data: meals, error: mealsError } = await supabaseClient
      .from('user_meal_history')
      .select(`
        meal_date,
        recipes (
          title,
          ingredients,
          recipe,
          calories
        )
      `)
      .eq('user_id', user.id)
      .gte('meal_date', weekStartDate.toISOString().split('T')[0])
      .lte('meal_date', weekEndDate.toISOString().split('T')[0])
      .order('meal_date');

    if (mealsError || !meals || meals.length === 0) {
      throw new Error("No meal plan found for user");
    }

    logStep("Meal plan found", { mealCount: meals.length });

    // Generate email HTML
    const weekStart = weekStartDate;
    const weekEnd = weekEndDate;

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    };

    const mealCards = meals.map((meal: any) => {
      const dayName = new Date(meal.meal_date).toLocaleDateString('en-US', { weekday: 'long' });
      const recipe = meal.recipes;
      
      return `
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #4A5D23; margin: 0 0 8px 0; font-size: 18px;">${dayName}</h3>
          <h4 style="margin: 0 0 8px 0; color: #333333;">${recipe.title}</h4>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <span style="background: #E87461; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">🔥 ${recipe.calories} cal</span>
          </div>
        </div>
      `;
    }).join('');

    const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Your Weekly Meal Plan</title>
      </head>
      <body style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #4A5D23; font-size: 28px; margin: 0;">🍽️ Curate My Plate</h1>
          <p style="color: #666666; margin: 8px 0 0 0;">Your personalized meal plan is ready!</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #4A5D23, #6B7D3A); color: white; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
          <h2 style="margin: 0 0 8px 0; font-size: 24px;">Week of ${formatDate(weekStart)}</h2>
          <p style="margin: 0; opacity: 0.9;">7 delicious dinners crafted just for you</p>
        </div>

        <div style="margin-bottom: 32px;">
          ${mealCards}
        </div>

        <div style="background: #F7F7F2; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 32px;">
          <h3 style="color: #4A5D23; margin: 0 0 12px 0;">Ready to cook?</h3>
          <p style="margin: 0 0 16px 0; color: #666666;">View your complete meal plan with recipes and shopping list</p>
          <a href="${req.headers.get("origin") || "https://your-domain.com"}/dashboard" 
             style="background: #E87461; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            View Full Plan →
          </a>
        </div>

        <div style="text-align: center; padding: 20px; border-top: 1px solid #E0E0E0; color: #666666; font-size: 14px;">
          <p style="margin: 0 0 8px 0;">Happy cooking! 👨‍🍳</p>
          <p style="margin: 0;">The Curate My Plate Team</p>
        </div>
      </body>
    </html>
    `;

    const emailResult = await resend.emails.send({
      from: "Curate My Plate <noreply@resend.dev>",
      to: [user.email],
      subject: `🍽️ Your Weekly Meal Plan - ${formatDate(weekStart)}`,
      html: emailHtml,
    });

    logStep("Email sent", { emailId: emailResult.data?.id });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResult.data?.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
