import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Recipe {
  id: string;
  name: string;
  description: string;
  cookTime: string;
  difficulty: string;
  image: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
}

interface RecipeModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

export const RecipeModal = ({ recipe, isOpen, onClose }: RecipeModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {recipe.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recipe Image and Info */}
          <div>
            <div className="w-full h-64 bg-gradient-warm rounded-lg mb-4 flex items-center justify-center">
              <span className="text-6xl">🍽️</span>
            </div>
            
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {recipe.description}
            </p>
            
            <div className="flex gap-3 mb-6">
              <Badge variant="secondary">
                ⏱️ {recipe.cookTime}
              </Badge>
              <Badge variant="outline">
                📊 {recipe.difficulty}
              </Badge>
              <Badge variant="secondary">
                🔥 {recipe.nutrition.calories} cal
              </Badge>
            </div>

            {/* Nutrition Info */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-card-foreground">Nutrition Per Serving</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Protein:</span>
                  <span className="ml-2 font-medium">{recipe.nutrition.protein}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Carbs:</span>
                  <span className="ml-2 font-medium">{recipe.nutrition.carbs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fat:</span>
                  <span className="ml-2 font-medium">{recipe.nutrition.fat}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Calories:</span>
                  <span className="ml-2 font-medium">{recipe.nutrition.calories}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ingredients and Instructions */}
          <div>
            <h4 className="font-semibold mb-3 text-card-foreground">Ingredients</h4>
            <ul className="space-y-2 mb-6">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-card-foreground">{ingredient}</span>
                </li>
              ))}
            </ul>

            <Separator className="mb-6" />

            <h4 className="font-semibold mb-3 text-card-foreground">Instructions</h4>
            <ol className="space-y-3">
              {recipe.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-sm text-card-foreground leading-relaxed">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              👍 Like
            </Button>
            <Button variant="outline" size="sm">
              👎 Dislike
            </Button>
            <Button variant="outline" size="sm">
              💬 Suggest Changes
            </Button>
          </div>
          
          <div className="flex gap-3">
            <Button variant="fresh" size="sm">
              📧 Email Recipe
            </Button>
            <Button variant="warm" size="sm">
              📄 Save as PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};