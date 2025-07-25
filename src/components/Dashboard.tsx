import { useState, useEffect, useCallback, useMemo } from "react";
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
import { SavedRecipes } from "./SavedRecipes";
import { parseIngredient } from "parse-ingredient";
import { Loader2, Download, RefreshCw, Star } from "lucide-react";
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

interface SubscriptionStatus {
    status: 'trial' | 'active';
    generations_remaining: number | null;
}

interface PantryItem {
  id: string;
  ingredient_name: string;
  quantity: string;
  expiry_date?: string;
}

interface DashboardProps {
  userProfile: UserProfile;
  onBackToQuiz?: () => void;
}

export const Dashboard = ({ userProfile }: DashboardProps) => {
  const { signOut, user, session } = useAuth();
  const { toast } = useToast();
  const [selectedMealDay, setSelectedMealDay] = useState<MealDay | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<MealDay[]>([]);
  const [shoppingList, setShoppingList] = useState<{ category: string, items: string[] }[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [shoppingListBudget, setShoppingListBudget] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pantryLoading, setPantryLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }, [session]);

  const loadPantryData = useCallback(async () => {
    if (!user) return;
    setPantryLoading(true);
    try {
      const { data: pantryData, error: pantryError } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (pantryError) throw pantryError;
      if (pantryData) {
        const itemsWithQuantity = pantryData.map(item => ({ ...item, quantity: item.quantity || '1' }));
        setPantryItems(itemsWithQuantity);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load pantry items.", variant: "destructive" });
    } finally {
      setPantryLoading(false);
    }
  }, [user, toast]);

  const loadInitialData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await checkSubscription();
      await loadPantryData();

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
        .gte('meal_date', new Date().toISOString().split('T')[0]) // Only get current and future meals
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

      if (shoppingListData && shoppingListData.shopping_list) {
        if (Array.isArray(shoppingListData.shopping_list)) {
          setShoppingList(shoppingListData.shopping_list as { category: string, items: string[] }[]);
        } else if (typeof shoppingListData.shopping_list === 'object') {
          const formattedList = Object.entries(shoppingListData.shopping_list).map(([category, items]) => ({
            category,
            items: items as string[]
          }));
          setShoppingList(formattedList);
        }
      } else {
          setShoppingList([]);
      }
    } catch (error) {
        console.error('Error loading initial data:', error);
    } finally {
        setLoading(false);
    }
  }, [user, checkSubscription, loadPantryData]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user, loadInitialData]);

  const generateMealPlan = async () => {
    if (!session?.access_token || !user) {
      toast({ title: "Authentication Error", description: "You must be signed in to generate a plan.", variant: "destructive" });
      return;
    }
    setGeneratingPlan(true);
    try {
        const pantryItemNames = pantryItems.map(item => item.ingredient_name);
        const requestBody = {
            userId: user.id,
            pantryItems: pantryItemNames,
            dietaryPreferences: userProfile.dietaryRestrictions.join(', '),
            cookTime: userProfile.cookingTime,
        };

        const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
            body: requestBody,
        });
        
        if (error) throw new Error(error.message);

        if (data.mealPlan) {
            setWeeklyPlan(data.mealPlan);
            toast({ title: "Success!", description: "Your new meal plan is ready." });
            await checkSubscription();
            // Reload the complete data to get the new shopping list
            await loadInitialData();
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
      const shoppingListForPDF = Array.isArray(shoppingList) 
        ? shoppingList 
        : Object.entries(shoppingList).map(([category, items]) => ({ category, items: items as string[] }));

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
        shoppingList: shoppingListForPDF,
      };

      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: sanitizedPayload
      });
      
      if (error) throw error;
      
      if (data && typeof data.pdf === 'string') {
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
        throw new Error("The server did not return a valid PDF file.");
      }
      
    } catch (error) {
        toast({ title: "PDF Generation Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };

  const addPantryItem = async (item: { name: string; quantity: string; expiry: string }) => {
    if (!user || !item.name.trim()) return;
    setPantryLoading(true);
    try {
      await supabase
        .from('pantry_items')
        .insert({
          user_id: user.id,
          ingredient_name: item.name.trim(),
          quantity: item.quantity || '1',
          expiry_date: item.expiry || null,
        });
      await loadPantryData();
      toast({ title: "Success", description: "Ingredient added to pantry" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add ingredient", variant: "destructive" });
    } finally {
      setPantryLoading(false);
    }
  };

  const updatePantryItemQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removePantryItem(id);
      return;
    }
    setPantryLoading(true);
    try {
      await supabase.from('pantry_items').update({ quantity: newQuantity.toString() }).eq('id', id);
      await loadPantryData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update quantity", variant: "destructive" });
    } finally {
      setPantryLoading(false);
    }
  };

  const removePantryItem = async (id: string) => {
    setPantryLoading(true);
    try {
      await supabase.from('pantry_items').delete().eq('id', id);
      await loadPantryData();
      toast({ title: "Success", description: "Ingredient removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove ingredient", variant: "destructive" });
    } finally {
      setPantryLoading(false);
    }
  };

  const [storedShoppingList, setStoredShoppingList] = useState<any>(null);
  const [shoppingListLoading, setShoppingListLoading] = useState(false);
  const [refreshingShoppingList, setRefreshingShoppingList] = useState(false);

  // Load stored shopping list from database
  const loadStoredShoppingList = async () => {
    setShoppingListLoading(true);
    try {
      const weekStartDate = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', user?.id)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error loading shopping list:', error);
        return;
      }

      setStoredShoppingList(data);
    } catch (error) {
      console.error('Error loading shopping list:', error);
    } finally {
      setShoppingListLoading(false);
    }
  };

  // Refresh shopping list based on current pantry items
  const refreshShoppingList = async () => {
    if (!user || !weeklyPlan || weeklyPlan.length === 0) {
      toast({ title: "Error", description: "No meal plan found. Please generate a meal plan first.", variant: "destructive" });
      return;
    }

    setRefreshingShoppingList(true);
    try {
      // Extract ingredients from current meal plan
      const allIngredients: string[] = [];
      
      weeklyPlan.forEach(mealDay => {
        if (mealDay.main_dish?.ingredients) {
          allIngredients.push(mealDay.main_dish.ingredients);
        }
        if (mealDay.side_dish?.ingredients) {
          allIngredients.push(mealDay.side_dish.ingredients);
        }
      });

      // Format pantry items for the process-shopping-list function
      const pantryItemsFormatted = pantryItems.map(item => ({
        ingredient_name: item.ingredient_name,
        quantity: item.quantity || '1'
      }));

      // Call the process-shopping-list function
      const { data: processedList, error: processError } = await supabase.functions.invoke('process-shopping-list', {
        body: {
          ingredients: allIngredients,
          pantryItems: pantryItemsFormatted
        }
      });

      if (processError) {
        throw new Error(`Failed to process shopping list: ${processError.message}`);
      }

      // Update the shopping list in the database
      const weekStartDate = new Date().toISOString().split('T')[0];
      const { error: updateError } = await supabase
        .from('shopping_lists')
        .upsert({
          user_id: user.id,
          week_start_date: weekStartDate,
          shopping_list: processedList?.categorizedList || {},
          ai_processed_ingredients: processedList?.ingredients || []
        }, { onConflict: 'user_id,week_start_date' });

      if (updateError) {
        throw new Error('Failed to save updated shopping list');
      }

      // Reload the shopping list
      await loadStoredShoppingList();
      
      toast({ 
        title: "Success!", 
        description: "Shopping list updated based on current pantry items." 
      });

    } catch (error) {
      console.error('Error refreshing shopping list:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to refresh shopping list", 
        variant: "destructive" 
      });
    } finally {
      setRefreshingShoppingList(false);
    }
  };

  // Load shopping list when component mounts or weekly plan changes
  useEffect(() => {
    if (user?.id) {
      loadStoredShoppingList();
    }
  }, [user?.id, weeklyPlan]);

  // Create dynamic shopping list by filtering stored list based on pantry items
  const adjustedShoppingList = useMemo(() => {
    if (!storedShoppingList?.ai_processed_ingredients || !Array.isArray(storedShoppingList.ai_processed_ingredients)) {
      if (weeklyPlan && weeklyPlan.length > 0 && !shoppingListLoading) {
        return [{ category: "Shopping List", items: ["AI-processed shopping list not available. Please regenerate your meal plan."] }];
      }
      return [];
    }

    console.log("🛒 Processing stored shopping list with pantry filtering");
    console.log("📦 Stored ingredients:", storedShoppingList.ai_processed_ingredients);
    console.log("🥫 Pantry items:", pantryItems);

    // Create pantry set for filtering
    const pantrySet = new Set(
      pantryItems.map(item => item.ingredient_name.toLowerCase().trim())
    );

    // Filter out pantry items from AI-processed ingredients
    const filteredIngredients = storedShoppingList.ai_processed_ingredients.filter((ingredient: any) => {
      const normalizedName = ingredient.name.toLowerCase().trim();
      const isInPantry = pantrySet.has(normalizedName);
      
      if (isInPantry) {
        console.log(`❌ Filtering out "${ingredient.name}" (in pantry)`);
      } else {
        console.log(`✅ Keeping "${ingredient.name}" (not in pantry)`);
      }
      
      return !isInPantry;
    });

    if (filteredIngredients.length === 0) {
      console.log("✨ All ingredients are in pantry!");
      setShoppingListBudget(null);
      return [{ category: "Shopping List", items: ["All ingredients are in your pantry!"] }];
    }

    // Group by category and calculate new total
    const categorizedList: Record<string, any[]> = {};
    let totalCost = 0;

    filteredIngredients.forEach((ingredient: any) => {
      if (!categorizedList[ingredient.category]) {
        categorizedList[ingredient.category] = [];
      }
      categorizedList[ingredient.category].push(ingredient);
      totalCost += ingredient.estimatedPrice || 0;
    });

    // Set the filtered budget
    setShoppingListBudget(`$${Math.round(totalCost)}`);

    // Convert to display format and sort
    const categoryOrder = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Grains & Bakery', 'Pantry Staples', 'Canned/Packaged', 'Other'];
    
    const result = Object.entries(categorizedList)
      .map(([category, items]) => ({
        category,
        items: items.map(item => `${item.quantity} ${item.name}`)
      }))
      .sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a.category);
        const bIndex = categoryOrder.indexOf(b.category);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

    console.log("✅ Final filtered shopping list:", result);
    return result;
  }, [storedShoppingList, pantryItems, weeklyPlan, shoppingListLoading]);

  
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="meals">Meal Plan</TabsTrigger>
            <TabsTrigger value="shopping">Shopping List</TabsTrigger>
            <TabsTrigger value="pantry">Pantry</TabsTrigger>
            <TabsTrigger value="saved">Saved Recipes</TabsTrigger>
          </TabsList>

          <TabsContent value="meals" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">
                This Week's Meal Plan
              </h2>
              <div className="flex items-center gap-3">
                <Button onClick={() => downloadPDF('full')} disabled={isDownloading || loading || weeklyPlan.length === 0} variant="outline">
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download Plan
                </Button>
                <div className="text-center">
                  <Button onClick={generateMealPlan} disabled={generatingPlan}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${generatingPlan ? 'animate-spin' : ''}`} />
                    {generatingPlan ? "Generating..." : "New Plan"}
                  </Button>
                  {subscription?.status === 'trial' && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500" /> 
                      {subscription.generations_remaining} trial generations left
                    </p>
                  )}
                </div>
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
                            <div className="md:col-span-1 h-48 md:h-full overflow-hidden rounded-l-lg">
                              <img 
                                src={mealDay.main_dish?.image_url || "/placeholder.svg"} 
                                alt={mealDay.main_dish?.title || "Meal"} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="md:col-span-2 p-6">
                              <CardTitle className="group-hover:text-primary transition-colors">{mealDay.main_dish?.title}</CardTitle>
                              {mealDay.side_dish && <CardDescription>with {mealDay.side_dish?.title}</CardDescription>}
                              <div className="flex gap-2 mt-4">
                                  <Badge variant="secondary">{mealDay.total_time_to_cook}</Badge>
                                  <Badge variant="outline">🔥 {(mealDay.main_dish?.calories || 0) + (mealDay.side_dish?.calories || 0)} cal</Badge>
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
                         {shoppingListBudget && (
                             <CardDescription>
                                 Estimated Cost: {shoppingListBudget}
                             </CardDescription>
                         )}
                     </div>
                     <div className="flex gap-2">
                         <Button 
                             onClick={refreshShoppingList} 
                             disabled={refreshingShoppingList || loading || weeklyPlan.length === 0} 
                             variant="outline"
                             size="sm"
                         >
                             {refreshingShoppingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                             Refresh
                         </Button>
                         <Button onClick={() => downloadPDF('shopping')} disabled={isDownloading || loading || adjustedShoppingList.length === 0} variant="outline">
                             {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                             Print List
                         </Button>
                     </div>
                 </CardHeader>
                <CardContent>
                    {(loading || shoppingListLoading) ? (
                        <div className="text-center p-4">
                            <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                            <p className="text-sm text-muted-foreground">
                                {shoppingListLoading ? "Processing ingredients with AI..." : "Loading..."}
                            </p>
                        </div>
                    ) : adjustedShoppingList.length > 0 ? (
                        <div className="columns-2 md:columns-3 gap-8">
                            {adjustedShoppingList.map((section) => (
                                <div key={section.category} className="mb-4 break-inside-avoid">
                                    <h4 className="font-semibold text-lg mb-2 text-primary">{section.category}</h4>
                                    {section.items.length > 0 ? (
                                      <ul className="space-y-2">
                                          {section.items.map((item, index) => (
                                              <li key={index} className="flex items-center gap-3 text-sm">
                                                  <div className="w-4 h-4 border border-muted-foreground rounded-sm" />
                                                  <span>{item.trim().replace(/^- ?/, '')}</span>
                                              </li>
                                          ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No ingredients required.</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-muted-foreground">Your shopping list is empty.</p>}
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="pantry" className="mt-6">
            <PantryManager 
              items={pantryItems}
              onAddItem={addPantryItem}
              onUpdateItemQuantity={updatePantryItemQuantity}
              onRemoveItem={removePantryItem}
              loading={pantryLoading}
            />
          </TabsContent>

          <TabsContent value="saved" className="mt-6">
            <SavedRecipes />
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
