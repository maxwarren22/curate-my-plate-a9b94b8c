import { generateMealPlan } from "./index.ts";
import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { sinon } from "https://deno.land/x/sinon@v2.0.1/mod.ts";

const mockSupabase = {
  auth: {
    getUser: sinon.stub().resolves({
      data: { user: { id: "user-123" } },
      error: null,
    }),
  },
  from: sinon.stub().returnsThis(),
  select: sinon.stub().returnsThis(),
  eq: sinon.stub().returnsThis(),
  single: sinon.stub().resolves({
    data: {
      subscription_status: "trial",
      generations_remaining: 1,
      dietary_restrictions: ["vegetarian"],
      cuisine_preferences: ["italian"],
      health_goals: "lose weight",
      cooking_time: "30-45 minutes",
      meal_types: ["Dinner"],
    },
    error: null,
  }),
  upsert: sinon.stub().resolves({ error: null }),
  functions: sinon.stub().returnsThis(),
  invoke: sinon.stub().resolves({ error: null }),
};

globalThis.fetch = sinon.stub().resolves(
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meal_plan: [
                {
                  day: "Monday",
                  main_dish: { title: "Spaghetti", description: "Classic spaghetti", ingredients: "Pasta\nSauce", recipe: "Boil pasta\nAdd sauce", calories: 500, servings: 2, prep_time: 10, cook_time: 20 },
                  side_dish: { title: "Salad", description: "Fresh garden salad", ingredients: "Lettuce\nTomato", recipe: "Chop vegetables\nToss", calories: 150, servings: 2, prep_time: 5, cook_time: 0 },
                  total_time_to_cook: "30 minutes",
                  cooking_tips: "Don't overcook the pasta.",
                },
              ],
            }),
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  )
);

const request = new Request("http://localhost:8000", {
  method: "POST",
  headers: {
    Authorization: "Bearer fake-token",
    "Content-Type": "application/json",
  },
});

const response = await generateMealPlan(request, mockSupabase, "fake-api-key");
const data = await response.json();

assertEquals(response.status, 200);
assert(data.success);
assertEquals(data.message, "Meal plan generated successfully");
assert(Array.isArray(data.mealPlan));
console.log("Test passed!");
