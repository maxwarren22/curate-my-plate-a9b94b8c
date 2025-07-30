import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY'); // Assumes Resend is used for emails

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const getDayOfWeek = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

serve(async (_req) => {
  try {
    if (!resendApiKey) {
      throw new Error("Email service API key is missing. Cannot send emails.");
    }

    const currentDay = getDayOfWeek();
    console.log(`Starting weekly plan job for: ${currentDay}`);

    // 1. Fetch all active subscribers who should receive their plan today
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('user_id, display_name, users(email)')
      .eq('plan_generation_day', currentDay)
      .eq('subscription_status', 'active');

    if (userError) throw new Error(`Failed to fetch users: ${userError.message}`);
    if (!users || users.length === 0) {
      console.log(`No users scheduled for meal plan generation today.`);
      return new Response(JSON.stringify({ success: true, message: "No users to process." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${users.length} user(s) to process.`);

    // 2. Process each user
    for (const profile of users) {
      const { user_id, display_name } = profile;
      const userEmail = profile.users?.email;

      if (!userEmail) {
        console.error(`Skipping user ${user_id} due to missing email.`);
        continue;
      }

      try {
        console.log(`Generating plan for user: ${user_id}`);
        // 2a. Generate a new meal plan
        // We need to invoke the function as the specific user
        const { data: planData, error: planError } = await supabase.functions.invoke(`generate-meal-plan`, {
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}` // Using service key to act on behalf of user
            },
            body: { userId: user_id } // Pass user ID to identify the user
        });

        if (planError) throw new Error(`Failed to generate meal plan: ${planError.message}`);
        
        const mealPlan = planData.mealPlan;

        console.log(`Generating PDF for user: ${user_id}`);
        // 2b. Generate PDF of the new plan
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-pdf', {
          body: { type: 'full', meals: mealPlan, shoppingList: [] } // Assuming shopping list is handled separately or not in email
        });

        if (pdfError) throw new Error(`PDF generation failed: ${pdfError.message}`);

        console.log(`Sending email to user: ${user_id}`);
        // 2c. Email the PDF
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'noreply@curatemyplate.com', // Replace with your sending domain
            to: userEmail,
            subject: 'Your Weekly Meal Plan is Here!',
            html: `
              <h1>Hi ${display_name || 'there'},</h1>
              <p>Your new meal plan from Curate My Plate is attached.</p>
              <p>Happy cooking!</p>
            `,
            attachments: [{
              filename: 'weekly-meal-plan.pdf',
              content: pdfData.pdf,
            }],
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(`Failed to send email: ${JSON.stringify(errorBody)}`);
        }

        console.log(`Successfully processed and emailed plan for user: ${user_id}`);

      } catch (userProcessingError) {
        console.error(`Error processing user ${user_id}:`, userProcessingError.message);
        // Continue to the next user
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Weekly plans sent successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-weekly-plan function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});