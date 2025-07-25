import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { MealDay, Recipe } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface RecipeModalProps {
  mealDay: MealDay;
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackStatus = {
  [key: string]: { liked: boolean; disliked: boolean };
};

const formatListFromString = (listString: string | undefined): string[] => {
  console.log('formatListFromString called with:', listString, 'type:', typeof listString);
  if (!listString || typeof listString !== 'string') return [];
  return listString.split(/\s*(?:\n|-)\s*/).filter(item => item.trim() !== '').map(item => item.trim());
};

const formatRecipeSteps = (steps: string | undefined): string[] => {
  if (!steps) return [];
  return steps.split(/\s*(?:\d+\.\s*)\s*/).filter(item => item.trim() !== '');
};

export const RecipeModal = ({ mealDay, isOpen, onClose }: RecipeModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>({});

  const handleFeedback = async (recipeId: string, feedback: 'like' | 'dislike') => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to give feedback.", variant: "destructive" });
      return;
    }

    const targetTable = feedback === 'like' ? 'liked_recipes' : 'disliked_recipes';
    const oppositeTable = feedback === 'like' ? 'disliked_recipes' : 'liked_recipes';
    
    const currentStatus = feedbackStatus[recipeId] || { liked: false, disliked: false };
    const isCurrentlyActive = feedback === 'like' ? currentStatus.liked : currentStatus.disliked;

    try {
      // If currently active, remove the feedback
      if (isCurrentlyActive) {
        await supabase.from(targetTable).delete().match({ user_id: user.id, recipe_id: recipeId });
        setFeedbackStatus(prev => ({ ...prev, [recipeId]: { liked: false, disliked: false } }));
        toast({ title: "Feedback removed" });
      } else {
        // Remove from the opposite table first to avoid conflicts
        await supabase.from(oppositeTable).delete().match({ user_id: user.id, recipe_id: recipeId });
        
        // Add to the target table
        await supabase.from(targetTable).insert({ user_id: user.id, recipe_id: recipeId });
        
        setFeedbackStatus(prev => ({
          ...prev,
          [recipeId]: {
            liked: feedback === 'like',
            disliked: feedback === 'dislike',
          }
        }));
        toast({ title: "Feedback saved!" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save feedback.", variant: "destructive" });
    }
  };

  useEffect(() => {
    const checkFeedbackStatus = async () => {
      if (!user || !isOpen) return;
      
      const recipeIds = [mealDay.main_dish.id, mealDay.side_dish?.id].filter(Boolean);
      
      const { data: liked } = await supabase
        .from('liked_recipes')
        .select('recipe_id')
        .eq('user_id', user.id)
        .in('recipe_id', recipeIds);

      const { data: disliked } = await supabase
        .from('disliked_recipes')
        .select('recipe_id')
        .eq('user_id', user.id)
        .in('recipe_id', recipeIds);

      const newStatus: FeedbackStatus = {};
      recipeIds.forEach(id => {
        newStatus[id] = {
          liked: liked?.some(r => r.recipe_id === id) || false,
          disliked: disliked?.some(r => r.recipe_id === id) || false,
        };
      });
      setFeedbackStatus(newStatus);
    };

    checkFeedbackStatus();
  }, [user, isOpen, mealDay]);

  const renderFeedbackButtons = (recipe: Recipe) => {
    const status = feedbackStatus[recipe.id] || { liked: false, disliked: false };
    return (
      <div className="flex gap-3">
        <Button variant={status.liked ? "default" : "outline"} size="sm" onClick={() => handleFeedback(recipe.id, 'like')}>
          <ThumbsUp className="w-4 h-4 mr-2" /> Like
        </Button>
        <Button variant={status.disliked ? "destructive" : "outline"} size="sm" onClick={() => handleFeedback(recipe.id, 'dislike')}>
          <ThumbsDown className="w-4 h-4 mr-2" /> Dislike
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <ScrollArea className="h-[85vh] p-4 pr-6">
            <div className="h-64 bg-gradient-warm rounded-lg mb-6 flex items-center justify-center">
                <span className="text-7xl opacity-70">🍽️</span>
            </div>
          <DialogHeader className="mb-4 text-left">
            <DialogTitle className="text-3xl font-bold text-primary mb-1">
              {mealDay.main_dish.title}
            </DialogTitle>
            <DialogDescription className="text-lg text-muted-foreground">
              with {mealDay.side_dish?.title || 'No side dish'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant="secondary">⏱️ {mealDay.total_time_to_cook}</Badge>
            <Badge variant="outline">🍽️ Serves {mealDay.main_dish.servings}</Badge>
            <Badge variant="secondary">🔥 {mealDay.main_dish.calories + (mealDay.side_dish?.calories || 0)} total cal</Badge>
          </div>
          
          {mealDay.cooking_tips && (
              <div className="bg-muted/50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold mb-2 text-card-foreground flex items-center gap-2">💡 Cooking Tip</h4>
                <p className="text-sm text-muted-foreground">{mealDay.cooking_tips}</p>
              </div>
          )}

          <div className="grid md:grid-cols-2 gap-x-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-card-foreground">Ingredients</h3>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-muted-foreground">{mealDay.main_dish.title}</h4>
                  {renderFeedbackButtons(mealDay.main_dish)}
                </div>
                <ul className="space-y-2 mb-4">
                  {formatListFromString(mealDay.main_dish.ingredients).map((item, index) => (
                    <li key={`main-ing-${index}`} className="flex gap-2 items-start text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {mealDay.side_dish && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-muted-foreground">{mealDay.side_dish.title}</h4>
                      {renderFeedbackButtons(mealDay.side_dish)}
                    </div>
                    <ul className="space-y-2">
                      {formatListFromString(mealDay.side_dish.ingredients).map((item, index) => (
                        <li key={`side-ing-${index}`} className="flex gap-2 items-start text-sm">
                          <Check className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
               <div>
                <h3 className="text-lg font-semibold mb-3 text-card-foreground">Instructions</h3>
                <h4 className="font-medium mb-3 text-muted-foreground">{mealDay.main_dish.title}</h4>
                <ol className="space-y-3">
                  {formatRecipeSteps(mealDay.main_dish.recipe).map((step, index) => (
                    <li key={`main-step-${index}`} className="flex gap-3 items-start">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-1">
                        {index + 1}
                      </div>
                      <span className="text-sm text-card-foreground leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <Separator />

              {mealDay.side_dish && (
                <div>
                  <h4 className="font-medium mb-3 text-muted-foreground">{mealDay.side_dish.title}</h4>
                  <ol className="space-y-3">
                    {formatRecipeSteps(mealDay.side_dish.recipe).map((step, index) => (
                      <li key={`side-step-${index}`} className="flex gap-3 items-start">
                        <div className="w-6 h-6 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-1">
                          {index + 1}
                        </div>
                        <span className="text-sm text-card-foreground leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};