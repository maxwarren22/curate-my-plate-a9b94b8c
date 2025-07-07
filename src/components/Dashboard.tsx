import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecipeModal } from "./RecipeModal";

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

interface DashboardProps {
  userProfile: any;
  onBackToQuiz: () => void;
}

export const Dashboard = ({ userProfile, onBackToQuiz }: DashboardProps) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Mock data for the meal plan
  const weeklyPlan: Record<string, Recipe[]> = {
    Monday: [
      {
        id: '1',
        name: 'Mediterranean Quinoa Bowl',
        description: 'Fresh quinoa bowl with roasted vegetables, feta cheese, and tahini dressing',
        cookTime: '25 min',
        difficulty: 'Easy',
        image: '/placeholder.svg',
        ingredients: [
          '1 cup quinoa',
          '1 cucumber, diced',
          '1 cup cherry tomatoes',
          '1/2 red onion',
          '1/2 cup feta cheese',
          '1/4 cup tahini',
          '2 tbsp olive oil',
          'Fresh herbs'
        ],
        instructions: [
          'Cook quinoa according to package instructions',
          'Dice vegetables and prepare dressing',
          'Combine all ingredients in a bowl',
          'Drizzle with tahini dressing and serve'
        ],
        nutrition: {
          calories: 420,
          protein: '15g',
          carbs: '45g',
          fat: '18g'
        }
      }
    ],
    Tuesday: [
      {
        id: '2',
        name: 'Grilled Salmon with Asparagus',
        description: 'Perfectly seasoned salmon with roasted asparagus and lemon',
        cookTime: '20 min',
        difficulty: 'Medium',
        image: '/placeholder.svg',
        ingredients: [
          '4 salmon fillets',
          '1 lb asparagus',
          '2 lemons',
          '3 cloves garlic',
          'Olive oil',
          'Salt and pepper',
          'Fresh dill'
        ],
        instructions: [
          'Preheat grill to medium-high heat',
          'Season salmon with salt, pepper, and dill',
          'Grill salmon 4-5 minutes per side',
          'Roast asparagus with garlic and lemon'
        ],
        nutrition: {
          calories: 350,
          protein: '35g',
          carbs: '8g',
          fat: '20g'
        }
      }
    ],
    // ... more days would be added here
  };

  const shoppingList = [
    'Quinoa (1 cup)',
    'Cucumber (1 large)',
    'Cherry tomatoes (1 cup)',
    'Red onion (1/2)',
    'Feta cheese (1/2 cup)',
    'Tahini (1/4 cup)',
    'Salmon fillets (4 pieces)',
    'Asparagus (1 lb)',
    'Lemons (2)',
    'Fresh herbs (dill, parsley)',
    'Olive oil',
    'Garlic (3 cloves)'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <div className="bg-card shadow-soft border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your Meal Plan Dashboard</h1>
              <p className="text-muted-foreground">Week of January 15-21, 2024</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBackToQuiz}>
                Retake Quiz
              </Button>
              <Button variant="warm">
                Generate PDF
              </Button>
              <Button variant="fresh">
                Email Plan
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground">This Week's Meals</h2>
              
              <div className="space-y-6">
                {Object.entries(weeklyPlan).map(([day, recipes]) => (
                  <Card key={day} className="shadow-soft border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg text-primary">{day}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recipes.map((recipe) => (
                          <div
                            key={recipe.id}
                            className="group cursor-pointer"
                            onClick={() => setSelectedRecipe(recipe)}
                          >
                            <div className="bg-muted/50 rounded-lg p-4 hover:shadow-medium transition-all duration-300 hover:bg-muted/70">
                              <div className="w-full h-32 bg-gradient-warm rounded-md mb-3 flex items-center justify-center">
                                <span className="text-3xl">🍽️</span>
                              </div>
                              <h4 className="font-medium text-card-foreground mb-2 group-hover:text-primary transition-colors">
                                {recipe.name}
                              </h4>
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {recipe.description}
                              </p>
                              <div className="flex gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {recipe.cookTime}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {recipe.difficulty}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Summary */}
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Your Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Dietary Restrictions:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {userProfile?.dietaryRestrictions?.map((restriction: string) => (
                      <Badge key={restriction} variant="secondary" className="text-xs">
                        {restriction}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">Cooking Time:</p>
                  <p className="text-sm text-muted-foreground">{userProfile?.cookingTime}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">Skill Level:</p>
                  <p className="text-sm text-muted-foreground">{userProfile?.skillLevel}</p>
                </div>
              </CardContent>
            </Card>

            {/* Shopping List */}
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Shopping List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {shoppingList.slice(0, 8).map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-4 h-4 border border-muted-foreground rounded"></div>
                      <span className="text-sm text-card-foreground">{item}</span>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    View Full List
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📝 Suggest Changes
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  ⭐ Rate This Week
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🔄 Generate New Plan
                </Button>
                <Button variant="hero" size="sm" className="w-full justify-start">
                  💳 Upgrade Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Recipe Modal */}
      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  );
};