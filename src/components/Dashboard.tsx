import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RecipeModal } from "./RecipeModal";
import { PantryManager } from "./PantryManager";
import { ProfileModal } from "./ProfileModal";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { MealDay } from "@/types";

interface UserProfile {
  dietaryRestrictions: string[];
  mealTypes: string[];
  cookingTime: string;
  cuisinePreferences: string[];
  skillLevel: string;
  servingSize: string;
  budget: string;
}

interface DashboardProps {
  userProfile: UserProfile;
}

export const Dashboard = ({ userProfile }: DashboardProps) => {
  const { signOut, user, session } = useAuth();
  const { toast } = useToast();
  const [selectedMealDay, setSelectedMealDay] = useState<MealDay | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<MealDay[]>([]);
  const [shoppingList, setShoppingList] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: mealHistory, error: mealError } = await supabase
        .from('user_meal_history')
        .select(`
            meal_date,
            total_time_to_cook,
            cooking_tips,
            main_dish:recipes!main_dish_recipe_id(*),
            side_dish:recipes!side_dish_recipe_id(*)
        `)
        .eq('user_id', user.id)
        .order('meal_date', { ascending: true })
        .limit(7);

      if (mealError) throw mealError;

      if (mealHistory && mealHistory.length > 0) {
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const transformedPlan = mealHistory.map((entry: any) => ({
            day: daysOfWeek[new Date(entry.meal_date + 'T00:00:00').getDay()],
            main_dish: entry.main_dish,
            side_dish: entry.side_dish,
            total_time_to_cook: entry.total_time_to_cook,
            cooking_tips: entry.cooking_tips,
        }));
        setWeeklyPlan(transformedPlan);
      } else {
        setWeeklyPlan([]);
      }

      const { data: shoppingListData, error: shoppingListError } = await supabase
          .from('shopping_lists')
          .select('*')
          .eq('user_id', user.id)
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle();
      
      if (shoppingListError) console.error("Could not load shopping list", shoppingListError.message);

      if (shoppingListData && typeof shoppingListData.shopping_list === 'object' && shoppingListData.shopping_list !== null) {
          setShoppingList(shoppingListData.shopping_list as Record<string, string[]>);
      } else {
          setShoppingList({});
      }

    } catch (error) {
        console.error('Error loading initial data:', error);
    } finally {
        setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const generateMealPlan = async () => {
    if (!session?.access_token) {
      toast({ title: "Authentication Error", description: "You must be signed in to generate a plan.", variant: "destructive" });
      return;
    }
    setGeneratingPlan(true);
    try {
        const { data, error } = await supabase.functions.invoke('generate-meal-plan');
        
        if (error) throw new Error(error.message);

        if (data.success && data.mealPlan) {
            setWeeklyPlan(data.mealPlan.meal_plan);
            setShoppingList(data.mealPlan.shopping_list);
            toast({ title: "Success!", description: "Your new meal plan is ready." });
        } else {
            throw new Error(data.error || "Failed to get meal plan data from server.");
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Could not generate a new meal plan.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setGeneratingPlan(false);
    }
  };
  
const downloadPDF = async (type: 'full' | 'shopping') => {
    if (!session) {
      toast({ title: "Authentication Error", description: "You must be signed in to download a PDF.", variant: "destructive" });
      return;
    }

    setIsDownloading(true);
    try {
      const sanitizedPayload = {
        type,
        meals: weeklyPlan.map(meal => ({
          day: meal.day,
          main_dish: {
            title: meal.main_dish.title,
            ingredients: meal.main_dish.ingredients,
            recipe: meal.main_dish.recipe,
            calories: meal.main_dish.calories,
          },
          side_dish: meal.side_dish ? {
            title: meal.side_dish.title,
            ingredients: meal.side_dish.ingredients,
            recipe: meal.side_dish.recipe,
            calories: meal.side_dish.calories,
          } : null,
          total_time_to_cook: meal.total_time_to_cook,
          cooking_tips: meal.cooking_tips,
        })),
        shoppingList: shoppingList,
      };

      // Expect a JSON response from the function
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: sanitizedPayload,
      });

      if (error) throw error;

      // Check for the 'pdf' property in the JSON response
      if (data && typeof data.pdf === 'string') {
        // Use the modern fetch API to decode the Base64 string into a Blob
        const blob = await (await fetch(`data:application/pdf;base64,${data.pdf}`)).blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-plan.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        console.error("The server did not return a valid PDF in the JSON response. Response:", data);
        throw new Error("An unexpected response was received from the server.");
      }

    } catch (error) {
        toast({ title: "PDF Generation Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="bg-card shadow-soft border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">🍽️ Curate My Plate</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setProfileOpen(true)}>My Profile</Button>
            <Button variant="outline" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="meals" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="meals">Meal Plan</TabsTrigger>
            <TabsTrigger value="shopping">Shopping List</TabsTrigger>
            <TabsTrigger value="pantry">Pantry</TabsTrigger>
          </TabsList>

          <TabsContent value="meals" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">
                This Week's Meal Plan
              </h2>
              <div className="flex gap-3">
                <Button onClick={() => downloadPDF('full')} disabled={isDownloading || loading || weeklyPlan.length === 0} variant="outline">
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download Plan
                </Button>
                <Button onClick={generateMealPlan} disabled={generatingPlan}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${generatingPlan ? 'animate-spin' : ''}`} />
                  {generatingPlan ? "Generating..." : "New Plan"}
                </Button>
              </div>
            </div>
            {loading ? (
                <div className="text-center p-8"><Loader2 className="w-8 h-8 mx-auto animate-spin" /></div>
            ) : (
              <div className="space-y-8">
                {weeklyPlan.length > 0 ? (
                    weeklyPlan.map((mealDay) => (
                      <div key={mealDay.day}>
                        <h3 className="text-2xl font-bold text-foreground mb-4 border-b pb-2">{mealDay.day}</h3>
                        <Card className="group cursor-pointer" onClick={() => setSelectedMealDay(mealDay)}>
                           <div className="grid md:grid-cols-3">
                            <div className="md:col-span-1 h-48 md:h-full bg-gradient-warm flex items-center justify-center rounded-l-lg">
                              <span className="text-7xl opacity-70">🍽️</span>
                            </div>
                            <div className="md:col-span-2 p-6">
                              <CardTitle className="group-hover:text-primary transition-colors">{mealDay.main_dish.title}</CardTitle>
                              {mealDay.side_dish && <CardDescription>with {mealDay.side_dish.title}</CardDescription>}
                              <div className="flex gap-2 mt-4">
                                  <Badge variant="secondary">{mealDay.total_time_to_cook}</Badge>
                                  <Badge variant="outline">🔥 {(mealDay.main_dish.calories || 0) + (mealDay.side_dish?.calories || 0)} cal</Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ))
                ) : (
                    <Card className="text-center p-8"><CardContent><h3 className="text-lg font-semibold">No Meal Plan Found</h3><p>Click "New Plan" to generate one.</p></CardContent></Card>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="shopping" className="space-y-6 mt-6">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Shopping List</CardTitle>
                        <CardDescription>Items to buy for this week's meals.</CardDescription>
                    </div>
                    <Button onClick={() => downloadPDF('shopping')} disabled={isDownloading || loading || Object.keys(shoppingList).length === 0} variant="outline">
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Print List
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? <div className="text-center p-4">Loading...</div> : Object.keys(shoppingList).length > 0 ? (
                        <div className="columns-2 md:columns-3 gap-8">
                            {Object.entries(shoppingList).map(([category, items]) => (
                                <div key={category} className="mb-4 break-inside-avoid">
                                    <h4 className="font-semibold text-lg mb-2 text-primary">{category}</h4>
                                    <ul className="space-y-2">
                                        {(items || []).map((item, index) => (
                                            <li key={index} className="flex items-center gap-3 text-sm">
                                                <div className="w-4 h-4 border border-muted-foreground rounded-sm" />
                                                <span>{item.trim().replace(/^- ?/, '')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-muted-foreground">Your shopping list is empty.</p>}
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="pantry" className="mt-6">
            <PantryManager onPantryChange={() => { /* This will be used later */ }} />
          </TabsContent>
        </Tabs>
      </div>
      
      <ProfileModal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} />

      {selectedMealDay && (
        <RecipeModal
          mealDay={selectedMealDay}
          isOpen={!!selectedMealDay}
          onClose={() => setSelectedMealDay(null)}
        />
      )}
    </div>
  );
};