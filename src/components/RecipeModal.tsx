import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
import { MealDay } from "@/types"; // Import the shared type

interface RecipeModalProps {
  mealDay: MealDay;
  isOpen: boolean;
  onClose: () => void;
}

const formatListFromString = (listString: string | undefined): string[] => {
  if (!listString) return [];
  return listString.split(/\s*-\s*/).filter(item => item.trim() !== '').map(item => item.trim());
};

const formatRecipeSteps = (steps: string | undefined): string[] => {
  if (!steps) return [];
  return steps.split(/\s*(?:\d+\.\s*|\\n)\s*/).filter(item => item.trim() !== '');
};


export const RecipeModal = ({ mealDay, isOpen, onClose }: RecipeModalProps) => {
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
              with {mealDay.side_dish.title}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant="secondary">⏱️ {mealDay.total_time_to_cook}</Badge>
            <Badge variant="outline">🍽️ Serves {mealDay.main_dish.servings}</Badge>
            <Badge variant="secondary">🔥 {mealDay.main_dish.calories + mealDay.side_dish.calories} total cal</Badge>
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
                <h4 className="font-medium mb-2 text-muted-foreground">{mealDay.main_dish.title}</h4>
                <ul className="space-y-2 mb-4">
                  {formatListFromString(mealDay.main_dish.ingredients).map((item, index) => (
                    <li key={`main-ing-${index}`} className="flex gap-2 items-start text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <h4 className="font-medium mb-2 text-muted-foreground">{mealDay.side_dish.title}</h4>
                <ul className="space-y-2">
                  {formatListFromString(mealDay.side_dish.ingredients).map((item, index) => (
                    <li key={`side-ing-${index}`} className="flex gap-2 items-start text-sm">
                      <Check className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
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
            </div>

          </div>

          <div className="flex justify-between pt-6 mt-6 border-t">
            <div className="flex gap-3">
              <Button variant="outline" size="sm">👍 Like</Button>
              <Button variant="outline" size="sm">👎 Dislike</Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};