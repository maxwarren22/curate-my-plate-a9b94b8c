import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define a type for the user profile data
interface UserProfile {
  user_id: string;
  meal_plan_start_day: string;
  email: string;
}

// Helper to log steps consistently
const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[SEND-WEEKLY-PLAN] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required environment variables at the start
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const functionSecret = Deno.env.get("FUNCTION_SECRET");
    const siteUrl = Deno.env.get("SITE_URL") || "https://your-app.com";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !functionSecret) {
      throw new Error("Missing required environment variables.");
    }

    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${functionSecret}`) {
      logStep("ERROR: Unauthorized access attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    logStep("Function invoked with valid secret");

    const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendApiKey);

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = daysOfWeek[new Date().getDay()];

    logStep(`Today is ${currentDay}. Checking for users with this start day.`);

    const { data: profiles, error: profileError } = await supabaseAdminClient
      .from('user_profiles')
      .select('user_id, meal_plan_start_day, email')
      .eq('meal_plan_start_day', currentDay);

    if (profileError) {
      throw new Error(`Failed to fetch user profiles: ${profileError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      logStep(`No users found with a start day of ${currentDay}. Exiting.`);
      return new Response(JSON.stringify({ success: true, message: "No users to process." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typedProfiles: UserProfile[] = profiles;
    logStep(`Found ${typedProfiles.length} user(s) to process.`);

    for (const profile of typedProfiles) {
      try {
        logStep("Processing user", { userId: profile.user_id });

        const { error: invokeError } = await supabaseAdminClient.functions.invoke(
          'generate-meal-plan',
          { body: { user_id: profile.user_id } }
        );

        if (invokeError) {
          throw new Error(`Failed to invoke generate-meal-plan: ${invokeError.message}`);
        }

        logStep("Meal plan generated successfully for user", { userId: profile.user_id });

        await resend.emails.send({
          from: "Curate My Plate <noreply@resend.dev>",
          to: [profile.email],
          subject: `🍽️ Your New Weekly Meal Plan is Ready!`,
          html: `
            <h1>Your Meal Plan is Here!</h1>
            <p>Hi there,</p>
            <p>Your personalized meal plan for the week is ready. Head over to your dashboard to see what's cooking!</p>
            <a href="${siteUrl}/dashboard">View Your Plan</a>
            <p>Happy cooking!</p>
            <p>The Curate My Plate Team</p>
          `,
        });

        logStep("Email notification sent to user", { userId: profile.user_id, email: profile.email });

      } catch (userError) {
        const message = userError instanceof Error ? userError.message : "An unknown error occurred";
        logStep("ERROR processing user", { userId: profile.user_id, error: message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed_users: typedProfiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown server error occurred.";
    const stack = error instanceof Error ? error.stack : undefined;
    logStep("FATAL ERROR", { message, stack });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
