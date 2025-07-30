import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateMealPlan } from './index.ts';

// Mock Supabase client
const mockSupabase = {
    auth: {
        getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
        }),
    },
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    gte: vi.fn(() => mockSupabase),
    update: vi.fn(() => mockSupabase),
    single: vi.fn().mockResolvedValue({
        data: {
            subscription_status: 'trial',
            generations_remaining: 1,
            dietary_restrictions: ['vegetarian'],
            cuisine_preferences: ['italian'],
            health_goals: 'lose weight',
            cooking_time: '30-45 minutes',
            meal_types: ['Dinner'],
        },
        error: null,
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    functions: {
        invoke: vi.fn().mockResolvedValue({ error: null }),
    }
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

// Mock fetch
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            choices: [{
                message: {
                    content: JSON.stringify({
                        meal_plan: [
                            {
                                day: "Monday",
                                main_dish: { title: "Spaghetti", description: "Classic spaghetti", ingredients: "Pasta\nSauce", recipe: "Boil pasta\nAdd sauce", calories: 500, servings: 2, prep_time: 10, cook_time: 20 },
                                side_dish: { title: "Salad", description: "Fresh garden salad", ingredients: "Lettuce\nTomato", recipe: "Chop vegetables\nToss", calories: 150, servings: 2, prep_time: 5, cook_time: 0 },
                                total_time_to_cook: "30 minutes",
                                cooking_tips: "Don't overcook the pasta."
                            }
                        ]
                    })
                }
            }]
        }),
    })
);

describe('generate-meal-plan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate a meal plan successfully', async () => {
        const request = new Request('http://localhost:8000', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer fake-token',
                'Content-Type': 'application/json',
            },
        });

        const response = await generateMealPlan(request, mockSupabase, 'fake-api-key');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Meal plan generated successfully');
        expect(data.mealPlan).toBeInstanceOf(Array);
        expect(data.mealPlan.length).toBeGreaterThan(0);
    });
});
