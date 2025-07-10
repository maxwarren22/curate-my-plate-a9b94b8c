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
import { Loader2, Download, CreditCard, RefreshCw, Star, CheckCircle } from "lucide-react";
import { MealDay, Recipe } from "@/types";
import { generateShoppingList } from "@/lib/ingredient-utils";

interface DashboardProps {
  userProfile: any;
  onBackToQuiz: () => void;
}

export const Dashboard = ({ userProfile, onBackToQuiz }: DashboardProps) => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [selectedMealDay, setSelectedMealDay] = useState<MealDay | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<MealDay[]>([]);
  const [shoppingList, setShoppingList] = useState("");
  const [loading, setLoading] = useState({ pdf: false, email: false, checkout: false, plan: true });
  const [subscription, setSubscription] = useState<any>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(p => ({ ...p, plan: true }));
    try {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const weekStartDate = new Date(today.setDate(diff));
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);

      const { data: mealHistory, error: mealsError } = await supabase
        .from('user_meal_history')
        .select(`meal_date, total_time_to_cook, cooking_tips, main_dish:main_dish_recipe_id(*), side_dish:side_dish_recipe_id(*)`)
        .eq('user_id', user.id)
        .gte('meal_date', weekStartDate.toISOString().split('T')[0])
        .lte('meal_date', weekEndDate.toISOString().split('T')[0])
        .order('meal_date', { ascending: true });

      if (mealsError) throw mealsError;
      if (!mealHistory) return;

      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const assembledPlan: MealDay[] = mealHistory.map((meal: any) => {
        const mealDate = new Date(meal.meal_date + 'T00:00:00');
        return {
          day: daysOfWeek[mealDate.getDay()],
          main_dish: meal.main_dish,
          side_dish: meal.side_dish,
          total_time_to_cook: meal.total_time_to_cook,
          cooking_tips: meal.cooking_tips,
        };
      });

      setWeeklyPlan(assembledPlan);

      const { data: pantryItems } = await supabase
        .from('pantry_items')
        .select('ingredient_name')
        .eq('user_id', user.id);

      // --- FIX: Ensure the recipes array conforms to the Recipe[] type ---
      const recipes: Recipe[] = assembledPlan.flatMap(meal => {
        const dishes: Recipe[] = [];
        if (meal.main_dish && typeof meal.main_dish === 'object' && 'id' in meal.main_dish) dishes.push(meal.main_dish as Recipe);
        if (meal.side_dish && typeof meal.side_dish === 'object' && 'id' in meal.side_dish) dishes.push(meal.side_dish as Recipe);
        return dishes;
      });
      
      const aggregatedShoppingList = generateShoppingList(recipes, pantryItems || []);
      setShoppingList(aggregatedShoppingList);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Error", description: "Could not load your data.", variant: "destructive" });
    } finally {
      setLoading(p => ({ ...p, plan: false }));
    }
  }, [user, toast]);

  const checkSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({ status: 'trial', planType: 'weekly' });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
      checkSubscription();
    }
  }, [user, loadData, checkSubscription]);

  useEffect(() => {
    if (user && !loading.plan && weeklyPlan.length === 0 && !generatingPlan) {
      generateMealPlan();
    }
  }, [user, weeklyPlan, generatingPlan, loading.plan]);

  const generateMealPlan = async () => {
    if (!user) return;
    setGeneratingPlan(true);
    try {
      await supabase.functions.invoke('generate-meal-plan');
      await loadData();
      toast({ title: "Success!", description: "Your new meal plan is ready." });
    } catch (error) {
      toast({ title: "Error", description: "Could not generate a new meal plan.", variant: "destructive" });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const downloadPDF = async (type: 'full' | 'shopping') => {
    setLoading(prev => ({ ...prev, pdf: true }));
    try {
      const { data, error } = await supabase.functions.invoke('generate-pdf', { body: { type } });
      if (error) throw error;
      if (!(data instanceof Blob)) throw new Error("Invalid response from server.");
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-plan.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Success!", description: "Your PDF is downloading." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "PDF generation failed.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, pdf: false }));
    }
  };

  const createCheckout = async (planType: 'weekly' | 'monthly') => {
    setLoading(prev => ({ ...prev, checkout: true }));
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { planType } });
      if (error) throw error;
      if (data.url) window.location.href = data.url;
    } catch (error) {
      toast({ title: "Error", description: "Could not initiate subscription.", variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, checkout: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="bg-card shadow-soft border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">🍽️ Curate My Plate</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBackToQuiz}>Edit Preferences</Button>
            <Button variant="outline" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="meals" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="meals">Meal Plan</TabsTrigger>
            <TabsTrigger value="shopping">Shopping List</TabsTrigger>
            <TabsTrigger value="pantry">Pantry & Prefs</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>
          <TabsContent value="meals" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">This Week's Meal Plan</h2>
              <div className="flex gap-3">
                <Button onClick={() => downloadPDF('full')} disabled={loading.pdf || weeklyPlan.length === 0} variant="outline"><Download className="w-4 h-4 mr-2" /> Download Plan</Button>
                <Button onClick={generateMealPlan} disabled={generatingPlan || loading.plan} variant="default"><RefreshCw className={`w-4 h-4 mr-2 ${generatingPlan || loading.plan ? 'animate-spin' : ''}`} />{generatingPlan || loading.plan ? "Loading..." : "New Plan"}</Button>
              </div>
            </div>
            {loading.plan ? (
                <div className="text-center p-8"><Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" /><p className="text-muted-foreground">Loading your meal plan...</p></div>
            ) : (
              <div className="space-y-8">
                {weeklyPlan.length > 0 ? (
                    weeklyPlan.map((mealDay) => (
                      <div key={mealDay.day}>
                        <h3 className="text-2xl font-bold text-foreground mb-4 border-b pb-2">{mealDay.day}</h3>
                        <Card className="group cursor-pointer overflow-hidden shadow-soft border-0 transition-all hover:shadow-medium" onClick={() => setSelectedMealDay(mealDay)}>
                           <div className="grid md:grid-cols-3">
                            <div className="md:col-span-1 h-48 md:h-full bg-gradient-warm flex items-center justify-center"><span className="text-7xl opacity-70">🍽️</span></div>
                            <div className="md:col-span-2">
                              <CardHeader>
                                <CardTitle className="group-hover:text-primary transition-colors text-xl">{mealDay.main_dish.title}</CardTitle>
                                <CardDescription>with {mealDay.side_dish.title}</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="secondary">⏱️ {mealDay.total_time_to_cook}</Badge>
                                    <Badge variant="secondary">🍽️ {mealDay.main_dish.servings} servings</Badge>
                                    <Badge variant="outline">🔥 {mealDay.main_dish.calories + mealDay.side_dish.calories} total cal</Badge>
                                </div>
                              </CardContent>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ))
                ) : (
                    <Card className="text-center p-8"><CardContent><h3 className="text-lg font-semibold mb-2">Your Meal Plan is Empty</h3><p className="text-muted-foreground mb-4">Click 'New Plan' to get your first week of meals.</p></CardContent></Card>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="shopping" className="space-y-6 mt-6">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle>Shopping List</CardTitle><CardDescription>Items to buy for this week's meals.</CardDescription></div>
                    <Button onClick={() => downloadPDF('shopping')} disabled={loading.pdf || weeklyPlan.length === 0} variant="outline"><Download className="w-4 h-4 mr-2" /> Print List</Button>
                </CardHeader>
                <CardContent>
                    {shoppingList.length > 0 ? (
                        <ul className="space-y-2 text-sm text-foreground columns-2">
                            {shoppingList.split('\n').map((item, index) => item.trim() && (
                                <li key={index} className="flex items-center gap-3"><div className="w-4 h-4 border border-muted-foreground rounded-sm" /><span>{item.trim()}</span></li>
                            ))}
                        </ul>
                    ) : <p className="text-muted-foreground">Your shopping list is empty.</p>}
                </CardContent>
             </Card>
          </TabsContent>
          <TabsContent value="pantry" className="mt-6"><PantryManager /></TabsContent>
          <TabsContent value="subscription" className="mt-6">
             <Card>
                <CardHeader><CardTitle>Subscription Plan</CardTitle><CardDescription>Manage your subscription and billing details.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                    <Card className="p-6 bg-muted/50">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-lg">{subscription?.status === 'active' ? `${subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)} Plan` : 'Trial Plan'}</h3>
                                <p className="text-muted-foreground">Status: <span className="text-primary font-medium">{subscription?.status}</span></p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-primary" />
                        </div>
                    </Card>
                    <div className="text-center">
                        <p className="text-muted-foreground mb-4">Upgrade to unlock advanced features.</p>
                         <Button size="lg" onClick={() => createCheckout('monthly')} disabled={loading.checkout}><Star className="w-4 h-4 mr-2" /> Upgrade to Pro</Button>
                    </div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
      {selectedMealDay && (
        <RecipeModal mealDay={selectedMealDay} isOpen={!!selectedMealDay} onClose={() => setSelectedMealDay(null)} />
      )}
    </div>
  );
};