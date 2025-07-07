
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RecipeModal } from "./RecipeModal";
import { PantryManager } from "./PantryManager";
import { Loader2, Download, Mail, CreditCard, RefreshCw } from "lucide-react";

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
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<Record<string, Recipe[]>>({});
  const [shoppingList, setShoppingList] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    if (user) {
      loadMealPlan();
      checkSubscription();
    }
  }, [user]);

  const loadMealPlan = async () => {
    if (!user) return;

    try {
      // Get latest meal plan
      const { data: mealPlan, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading meal plan:', error);
        return;
      }

      if (mealPlan?.plan_data && typeof mealPlan.plan_data === 'object' && mealPlan.plan_data !== null && 'meals' in mealPlan.plan_data) {
        // Convert meal plan data to the expected format
        const convertedPlan: Record<string, Recipe[]> = {};
        const planData = mealPlan.plan_data as { meals: Record<string, any> };
        Object.entries(planData.meals).forEach(([day, meal]: [string, any]) => {
          convertedPlan[day] = [{
            id: `${day}-${meal.name}`,
            name: meal.name,
            description: meal.description,
            cookTime: meal.cookTime,
            difficulty: meal.difficulty,
            image: '/placeholder.svg',
            ingredients: meal.ingredients || [],
            instructions: meal.instructions || [],
            nutrition: meal.nutrition || { calories: 0, protein: '0g', carbs: '0g', fat: '0g' }
          }];
        });
        setWeeklyPlan(convertedPlan);

        // Load shopping list
        const { data: shoppingData } = await supabase
          .from('shopping_lists')
          .select('*')
          .eq('meal_plan_id', mealPlan.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (shoppingData?.items) {
          setShoppingList(shoppingData.items);
        }
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    }
  };

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const generateMealPlan = async () => {
    if (!user) return;

    setGeneratingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      await loadMealPlan();
      toast({
        title: "Success!",
        description: "Your new meal plan has been generated.",
      });
    } catch (error) {
      console.error('Error generating meal plan:', error);
      toast({
        title: "Error",
        description: "Failed to generate meal plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const createCheckout = async (planType: 'weekly' | 'monthly') => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planType },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout process.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Error",
        description: "Failed to open subscription management.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendWeeklyPlan = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-weekly-plan', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      toast({
        title: "Email Sent!",
        description: "Your meal plan has been sent to your email.",
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      // Create and download the file
      const blob = new Blob([data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meal-plan-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started!",
        description: "Your meal plan PDF is being downloaded.",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const flatShoppingList = Object.entries(shoppingList).flatMap(([category, items]: [string, any]) => 
    Array.isArray(items) ? items.slice(0, 8) : []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <div className="bg-card shadow-soft border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">🍽️ Curate My Plate</h1>
              <p className="text-muted-foreground">
                {subscription?.status === 'active' ? `${subscription.planType} Plan` : 'Free Trial'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBackToQuiz}>
                Update Preferences
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="meals" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="meals">Meal Plan</TabsTrigger>
            <TabsTrigger value="pantry">Pantry</TabsTrigger>
            <TabsTrigger value="shopping">Shopping</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="meals" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">This Week's Meals</h2>
              <div className="flex gap-3">
                <Button 
                  onClick={generateMealPlan} 
                  disabled={generatingPlan}
                  variant="default"
                >
                  {generatingPlan ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate New Plan
                    </>
                  )}
                </Button>
                <Button onClick={downloadPDF} disabled={loading} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={sendWeeklyPlan} disabled={loading} variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Plan
                </Button>
              </div>
            </div>

            {Object.keys(weeklyPlan).length === 0 ? (
              <Card className="text-center p-8">
                <CardContent>
                  <h3 className="text-lg font-semibold mb-4">No Meal Plan Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate your first personalized meal plan based on your preferences!
                  </p>
                  <Button onClick={generateMealPlan} disabled={generatingPlan}>
                    {generatingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Your Plan...
                      </>
                    ) : (
                      'Generate My First Meal Plan'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
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
            )}
          </TabsContent>

          <TabsContent value="pantry">
            <PantryManager />
          </TabsContent>

          <TabsContent value="shopping" className="space-y-6">
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="text-lg text-primary">🛒 Shopping List</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(shoppingList).length === 0 ? (
                  <p className="text-muted-foreground">
                    Generate a meal plan first to see your shopping list!
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(shoppingList).map(([category, items]: [string, any]) => {
                      if (!Array.isArray(items) || items.length === 0) return null;
                      return (
                        <div key={category}>
                          <h3 className="font-semibold text-primary mb-3">{category}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {items.map((item: string, index: number) => (
                              <div key={index} className="flex items-center gap-3">
                                <div className="w-4 h-4 border border-muted-foreground rounded"></div>
                                <span className="text-sm text-card-foreground">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="text-lg text-primary">💳 Subscription Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">
                        {subscription?.status === 'active' ? 'Active Subscription' : 'Free Trial'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {subscription?.status === 'active' 
                          ? `${subscription.planType} Plan`
                          : 'Limited to basic features'
                        }
                      </p>
                      {subscription?.currentPeriodEnd && (
                        <p className="text-sm text-muted-foreground">
                          Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
                      {subscription?.status === 'active' ? 'Active' : 'Trial'}
                    </Badge>
                  </div>
                </div>

                {subscription?.status !== 'active' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Upgrade Your Plan</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <h4 className="font-semibold mb-2">Weekly Plan</h4>
                        <p className="text-2xl font-bold text-primary mb-2">$9.99/week</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Fresh meal plans every week
                        </p>
                        <Button 
                          onClick={() => createCheckout('weekly')} 
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                          Subscribe Weekly
                        </Button>
                      </Card>
                      <Card className="p-4 border-primary">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">Monthly Plan</h4>
                          <Badge variant="default">Popular</Badge>
                        </div>
                        <p className="text-2xl font-bold text-primary mb-2">$29.99/month</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Save 25% with monthly billing
                        </p>
                        <Button 
                          onClick={() => createCheckout('monthly')} 
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                          Subscribe Monthly
                        </Button>
                      </Card>
                    </div>
                  </div>
                )}

                {subscription?.status === 'active' && (
                  <Button onClick={openCustomerPortal} disabled={loading} variant="outline">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                    Manage Subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
