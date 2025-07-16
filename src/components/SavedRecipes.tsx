import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Recipe } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

export const SavedRecipes = () => {
  const { user } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedRecipes = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('liked_recipes')
        .select('recipes(*)')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const recipes = data.map(item => item.recipes).filter((p): p is Recipe => p !== null);
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

    const channel = supabase
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Recipes</CardTitle>
      </CardHeader>
      <CardContent>
        {savedRecipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedRecipes.map(recipe => (
              <Card key={recipe.id}>
                <CardHeader>
                  <CardTitle>{recipe.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{recipe.cuisine}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p>You haven't saved any recipes yet.</p>
        )}
      </CardContent>
    </Card>
  );
};
