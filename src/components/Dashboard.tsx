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
import { Loader2, Download, CreditCard, RefreshCw, Star, CheckCircle, AlertTriangle } from "lucide-react";
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
  onBackToQuiz: () => void;
}

export const Dashboard = ({ userProfile, onBackToQuiz }: DashboardProps) => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [selectedMealDay, setSelectedMealDay] = useState<MealDay | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<MealDay[]>([]);
  const [shoppingList, setShoppingList] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState({ pdf: false, email: false, checkout: false, plan: true });
  const [subscription, setSubscription] = useState<{ status: string; planType: string; generations_remaining?: number } | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(prev => ({ ...prev, plan: true }));
    try {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const weekStartDate = new Date(today.setDate(diff));
        const weekStartDateString = weekStartDate.toISOString().split('T')[0];

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
            .gte('meal_date', weekStartDateString)
            .order('meal_date', { ascending: true });

        if (mealError) throw mealError;

        if (mealHistory && mealHistory.length > 0) {
            const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const transformedPlan = mealHistory.map((entry: any) => {
                const mealDate = new Date(entry.meal_date + 'T00:00:00');
                return {
                    day: daysOfWeek[mealDate.getDay()],
                    main_dish: entry.main_dish,
                    side_dish: entry.side_dish,
                    total_time_to_cook: entry.total_time_to_cook,
                    cooking_tips: entry.cooking_tips,
                };
            });
            setWeeklyPlan(transformedPlan);

            const { data: shoppingListData, error: shoppingListError } = await supabase
                .from('shopping_lists')
                .select('*')
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartDateString)
                .single();
            
            if (shoppingListError && shoppingListError.code !== 'PGRST116') {
                 console.error("Could not load shopping list", shoppingListError.message);
            }

            if (shoppingListData && typeof shoppingListData.shopping_list === 'object' && shoppingListData.shopping_list !== null) {
                setShoppingList(shoppingListData.shopping_list as Record<string, string[]>);
            }

        } else {
          setWeeklyPlan([]);
          setShoppingList({});
        }
    } catch (error) {
        console.error('Error loading initial meal plan:', error);
        setWeeklyPlan([]);
        setShoppingList({});
        toast({ title: "Info", description: "No meal plan found for this week. Click 'New Plan' to get started!", variant: "default" });
    } finally {
        setLoading(prev => ({ ...prev, plan: false }));
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
      toast({
          title: "Could not check subscription",
          description: "There was a problem verifying your subscription status.",
          variant: "destructive",
      });
      setSubscription(null);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      loadData();
      checkSubscription();
    }
  }, [user, loadData, checkSubscription]);

  const generateMealPlan = async () => {
    if (!user) return;
    setGeneratingPlan(true);
    try {
        const { data, error } = await supabase.functions.invoke('generate-meal-plan');
        if (error) throw error;

        if (data.success && data.mealPlan) {
            setWeeklyPlan(data.mealPlan.meal_plan);
            setShoppingList(data.mealPlan.shopping_list);
            toast({ title: "Success!", description: "Your new meal plan is ready." });
            checkSubscription();
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
    setLoading(prev => ({ ...prev, pdf: true }));
    try {
        const { data, error } = await supabase.functions.invoke('generate-pdf', {
            body: { type, meals: weeklyPlan, shoppingList },
        });

        if (error) throw error;
        if (!(data instanceof Blob)) {
            throw new Error("Invalid response from server. Expected a PDF file.");
        }

        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-plan-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        toast({ title: "Success!", description: "Your PDF is downloading." });
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            title: "PDF Generation Failed",
            description: errorMessage,
            variant: "destructive",
        });
    } finally {
        setLoading(prev => ({ ...prev, pdf: false }));
    }
  };
  
  const createCheckout = async (planType: 'weekly' | 'monthly') => {
    if (!user) return;
    setLoading(prev => ({ ...prev, checkout: true }));
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { planType } });
      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not initiate subscription.", variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, checkout: false }));
    }
  };

  const getMealsToDisplay = () => {
    if (subscription?.status !== 'active') {
      return weeklyPlan;
    }
    
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayIndex = new Date().getDay();
    return weeklyPlan.filter(mealDay => {
        const mealDayIndex = daysOfWeek.indexOf(mealDay.day);
        return mealDayIndex >= currentDayIndex;
    });
  };

  const mealsToDisplay = getMealsToDisplay();

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
              <h2 className="text-xl font-semibold text-foreground">
                {subscription?.status === 'active' ? 'Your Upcoming Meals' : "This Week's Meal Plan"}
              </h2>
              <div className="flex gap-3">
                <Button onClick={() => downloadPDF('full')} disabled={loading.pdf || weeklyPlan.length === 0} variant="outline">
                  <Download className="w-4 h-4 mr-2" /> Download Plan
                </Button>
                <Button onClick={generateMealPlan} disabled={generatingPlan || (subscription?.status === 'trial' && (!subscription.generations_remaining || subscription.generations_remaining <= 0))} variant="default">
                  <RefreshCw className={`w-4 h-4 mr-2 ${generatingPlan ? 'animate-spin' : ''}`} />
                  {generatingPlan ? "Generating..." : "New Plan"}
                </Button>
              </div>
            </div>

            {loading.plan || generatingPlan ? (
                <div className="text-center p-8">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" />
                    <p className="text-muted-foreground">
                        {generatingPlan ? "Generating your delicious meal plan..." : "Loading your meal plan..."}
                    </p>
                </div>
            ) : (
              <div className="space-y-8">
                {mealsToDisplay.length > 0 ? (
                    mealsToDisplay.map((mealDay, index) => (
                      <div key={mealDay.day}>
                        <h3 className="text-2xl font-bold text-foreground mb-4 border-b pb-2">
                          {subscription?.status === 'active' ? mealDay.day : `Day ${index + 1}`}
                        </h3>
                        <Card 
                          className="group cursor-pointer overflow-hidden shadow-soft border-0 transition-all hover:shadow-medium"
                          onClick={() => setSelectedMealDay(mealDay)}
                        >
                           <div className="grid md:grid-cols-3">
                            <div className="md:col-span-1 h-48 md:h-full bg-gradient-warm flex items-center justify-center">
                              <span className="text-7xl opacity-70">🍽️</span>
                            </div>
                            <div className="md:col-span-2">
                              <CardHeader>
                                <CardTitle className="group-hover:text-primary transition-colors text-xl">{mealDay.main_dish.title}</CardTitle>
                                <CardDescription>with {mealDay.side_dish.title}</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant="secondary">{mealDay.total_time_to_cook}</Badge>
                                    <Badge variant="outline">🔥 {mealDay.main_dish.calories + mealDay.side_dish.calories} cal</Badge>
                                </div>
                              </CardContent>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ))
                ) : (
                    <Card className="text-center p-8">
                        <CardContent>
                            <h3 className="text-lg font-semibold mb-2">
                                {subscription?.status === 'active' ? "All Meals Accounted For!" : "Your Meal Plan is Empty"}
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                {subscription?.status === 'active' 
                                    ? "You've seen all the meals for this week. Generate a new plan for next week!"
                                    : "Click 'Generate New Plan' to get your first week of meals."
                                }
                            </p>
                        </CardContent>
                    </Card>
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
                    <Button onClick={() => downloadPDF('shopping')} disabled={loading.pdf || Object.keys(shoppingList).length === 0} variant="outline">
                        <Download className="w-4 h-4 mr-2" /> Print List
                    </Button>
                </CardHeader>
                <CardContent>
                    {Object.keys(shoppingList).length > 0 ? (
                        <div className="columns-2 md:columns-3 gap-8">
                            {Object.entries(shoppingList).map(([category, items]) => (
                                <div key={category} className="mb-4 break-inside-avoid">
                                    <h4 className="font-semibold text-lg mb-2 text-primary">{category}</h4>
                                    <ul className="space-y-2">
                                        {items.map((item, index) => (
                                            <li key={index} className="flex items-center gap-3 text-sm">
                                                <div className="w-4 h-4 border border-muted-foreground rounded-sm" />
                                                <span>{item}</span>
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
            <PantryManager />
          </TabsContent>
          
          <TabsContent value="subscription" className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle>Subscription Plan</CardTitle>
                    <CardDescription>Manage your subscription and billing details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Card className="p-6 bg-muted/50">
                        <div className="flex justify-between items-center">
                            {subscription ? (
                                <div>
                                    <h3 className="font-semibold text-lg">
                                        {subscription?.status === 'active' ? `${subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)} Plan` : 'Trial Plan'}
                                    </h3>
                                    <p className="text-muted-foreground">Status: <span className="text-primary font-medium">{subscription.status}</span></p>
                                    {subscription?.status === 'trial' && (
                                        <p className="text-sm text-muted-foreground">
                                            Generations left: {subscription.generations_remaining ?? 'N/A'}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-destructive" />
                                    <p className="text-destructive">Could not load subscription status.</p>
                                </div>
                            )}
                             <CheckCircle className="w-8 h-8 text-primary" />
                        </div>
                    </Card>
                    <div className="text-center">
                        <p className="text-muted-foreground mb-4">Upgrade to a paid plan to unlock advanced features like automatic weekly planning and recipe feedback.</p>
                         <Button size="lg" onClick={() => createCheckout('monthly')} disabled={loading.checkout}>
                            <Star className="w-4 h-4 mr-2" /> Upgrade to Pro
                        </Button>
                    </div>
                </CardContent>
             </Card>
          </TabsContent>

        </Tabs>
      </div>

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