import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Recipe, MealDay } from '@/types';
import { RecipeModal } from './RecipeModal';
import { RealtimeChannel } from '@supabase/supabase-js';

export const SavedRecipes = () => {
  const { user } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const fetchSavedRecipes = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('liked_recipes')
        .select('recipes(*)')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const recipes = data.map((item: any) => item.recipes).filter((p): p is Recipe => p !== null);
      setSavedRecipes(recipes);
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSavedRecipes();

    const channel: RealtimeChannel = supabase
      .channel('liked_recipes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liked_recipes', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('Change received!', payload);
          fetchSavedRecipes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSavedRecipes]);

  const handleRecipeClick = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
  };

  const handleCloseModal = () => {
    setSelectedRecipe(null);
  };

  const recipeToMealDay = (recipe: Recipe | null): MealDay | null => {
    if (!recipe) return null;
    return {
      day: 'Saved Recipe',
      main_dish: recipe,
      side_dish: {
        title: '',
        ingredients: '',
        recipe: '',
        calories: 0,
        cuisine: '',
      },
      total_time_to_cook: recipe.total_time_to_cook || 'N/A',
      cooking_tips: recipe.cooking_tips,
    };
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Saved Recipes</CardTitle>
        </CardHeader>
        <CardContent>
          {savedRecipes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedRecipes.map(recipe => (
                <Card key={recipe.id} className="group cursor-pointer" onClick={() => handleRecipeClick(recipe)}>
                  <div className="h-48 bg-gradient-secondary flex items-center justify-center rounded-t-lg">
                    <span className="text-7xl opacity-70">📄</span>
                  </div>
                  <div className="p-6">
                    <CardTitle className="group-hover:text-primary transition-colors">{recipe.title}</CardTitle>
                    <div className="flex gap-2 mt-4">
                      {recipe.total_time_to_cook && <Badge variant="secondary">{recipe.total_time_to_cook}</Badge>}
                      {recipe.calories && <Badge variant="outline">🔥 {recipe.calories} cal</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p>You haven't saved any recipes yet.</p>
          )}
        </CardContent>
      </Card>
      {selectedRecipe && (
        <RecipeModal
          mealDay={recipeToMealDay(selectedRecipe) as MealDay}
          isOpen={!!selectedRecipe}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};
