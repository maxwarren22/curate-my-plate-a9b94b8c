import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Loader2, Star } from 'lucide-react';

const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'None'];
const cuisineOptions = ['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian'];
const timeOptions = ['15-30 minutes', '30-60 minutes', '1+ hours'];
const skillOptions = ['Beginner', 'Intermediate', 'Advanced'];
const budgetOptions = ['Under $50', '$50-$100', '$100-$150', '$150+', 'No budget constraints'];
const equipmentOptions = ['Oven', 'Microwave', 'Air Fryer', 'Instant Pot', 'Slow Cooker'];
const proteinOptions = ['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Beans & Lentils'];
const goalOptions = ['Weight Loss', 'Muscle Gain', 'General Wellness', 'Heart Health'];

// --- THIS IS THE FIX ---
// Create a local interface to match the full profiles table structure
interface ProfileData {
    dietary_restrictions: string[];
    cuisine_preferences: string[];
    cooking_time: string;
    skill_level: string;
    budget: string;
    health_goals: string;
    kitchen_equipment: string[];
    protein_preferences: string[];
}

export const PreferencesForm = () => {
    const { user, session } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<'trial' | 'active' | null>(null);

    const [dietary, setDietary] = useState<string[]>([]);
    const [cuisine, setCuisine] = useState<string[]>([]);
    const [cookingTime, setCookingTime] = useState<string>('');
    const [skillLevel, setSkillLevel] = useState<string>('');
    const [budget, setBudget] = useState<string>('');
    const [healthGoals, setHealthGoals] = useState<string>('');
    const [kitchenEquipment, setKitchenEquipment] = useState<string[]>([]);
    const [proteinPreferences, setProteinPreferences] = useState<string[]>([]);
    
    const [disliked, setDisliked] = useState<{ id: string; ingredient_name: string }[]>([]);
    const [newDislikedItem, setNewDislikedItem] = useState('');

    const checkSubscription = useCallback(async () => {
        if (!session) return;
        try {
            const { data } = await supabase.functions.invoke('check-subscription');
            setSubscriptionStatus(data.status);
        } catch (error) {
            console.error("Error checking subscription:", error);
        }
    }, [session]);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            setLoading(true);
            try {
                await checkSubscription();

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                
                if (profileError) throw profileError;

                if (profile) {
                    // Use the local interface for type safety
                    const typedProfile = profile as unknown as ProfileData;
                    setDietary(typedProfile.dietary_restrictions || []);
                    setCuisine(typedProfile.cuisine_preferences || []);
                    setCookingTime(typedProfile.cooking_time || '');
                    setSkillLevel(typedProfile.skill_level || '');
                    setBudget(typedProfile.budget || '');
                    setHealthGoals(typedProfile.health_goals || '');
                    setKitchenEquipment(typedProfile.kitchen_equipment || []);
                    setProteinPreferences(typedProfile.protein_preferences || []);
                }

                const { data: dislikedItems, error: dislikedError } = await supabase
                    .from('disliked_ingredients')
                    .select('id, ingredient_name')
                    .eq('user_id', user.id);
                
                if (dislikedError) throw dislikedError;
                setDisliked(dislikedItems || []);

            } catch (error) {
                toast({ title: "Error", description: "Could not fetch profile.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, toast, checkSubscription]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                dietary_restrictions: dietary,
                cuisine_preferences: cuisine,
                cooking_time: cookingTime,
                skill_level: skillLevel,
                budget: budget,
                health_goals: healthGoals,
                kitchen_equipment: kitchenEquipment,
                protein_preferences: proteinPreferences,
                updated_at: new Date().toISOString(),
            }).eq('user_id', user.id);

            if (error) throw error;
            toast({ title: "Success!", description: "Your preferences have been updated." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const addDisliked = async () => {
        if (!user || !newDislikedItem.trim()) return;
        const { data, error } = await supabase.from('disliked_ingredients').insert({
            user_id: user.id,
            ingredient_name: newDislikedItem.trim()
        }).select().single();

        if (error) {
             toast({ title: "Error", description: "Failed to add disliked ingredient.", variant: "destructive" });
        } else if (data) {
            setDisliked([...disliked, data]);
            setNewDislikedItem('');
        }
    };

    const removeDisliked = async (id: string) => {
        if (!user) return;
        await supabase.from('disliked_ingredients').delete().eq('id', id);
        setDisliked(disliked.filter(item => item.id !== id));
    };

    const PremiumWrapper = ({ children }: { children: React.ReactNode }) => {
        if (subscriptionStatus === 'active') {
            return <>{children}</>;
        }
        return (
            <div className="relative p-6 border rounded-lg bg-muted/30 opacity-60">
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10"></div>
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-700 text-xs font-semibold">
                    <Star className="w-4 h-4" />
                    Pro Feature
                </div>
                {children}
            </div>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <Label className="text-base">Dietary Restrictions</Label>
                <ToggleGroup type="multiple" value={dietary} onValueChange={setDietary} className="flex-wrap justify-start">
                    {dietaryOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>
            
            <div className="space-y-2">
                <Label className="text-base">Cuisine Preferences</Label>
                <ToggleGroup type="multiple" value={cuisine} onValueChange={setCuisine} className="flex-wrap justify-start">
                    {cuisineOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>
            
            <div className="space-y-2">
                <Label className="text-base">Cooking Time</Label>
                <ToggleGroup type="single" value={cookingTime} onValueChange={(val) => val && setCookingTime(val)} className="flex-wrap justify-start">
                    {timeOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>

            <div className="space-y-2">
                <Label className="text-base">Skill Level</Label>
                <ToggleGroup type="single" value={skillLevel} onValueChange={(val) => val && setSkillLevel(val)} className="flex-wrap justify-start">
                    {skillOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>

            <div className="space-y-2">
                <Label className="text-base">Weekly Food Budget</Label>
                <ToggleGroup type="single" value={budget} onValueChange={(val) => val && setBudget(val)} className="flex-wrap justify-start">
                    {budgetOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>
            
            <div className="space-y-2">
                <Label className="text-base">Health & Fitness Goals</Label>
                <ToggleGroup type="single" value={healthGoals} onValueChange={(val) => val && setHealthGoals(val)} className="flex-wrap justify-start">
                    {goalOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>

            <PremiumWrapper>
                <div className="space-y-2">
                    <Label className="text-base">Kitchen Equipment</Label>
                    <ToggleGroup type="multiple" value={kitchenEquipment} onValueChange={setKitchenEquipment} className="flex-wrap justify-start">
                        {equipmentOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                    </ToggleGroup>
                </div>
            </PremiumWrapper>

            <PremiumWrapper>
                <div className="space-y-2">
                    <Label className="text-base">Protein Preferences</Label>
                    <ToggleGroup type="multiple" value={proteinPreferences} onValueChange={setProteinPreferences} className="flex-wrap justify-start">
                        {proteinOptions.map(opt => <ToggleGroupItem key={opt} value={opt}>{opt}</ToggleGroupItem>)}
                    </ToggleGroup>
                </div>
            </PremiumWrapper>

            <Card>
                <CardHeader>
                    <CardTitle>Disliked Ingredients</CardTitle>
                    <CardDescription>We'll avoid these in your meal plans.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="e.g., Mushrooms" 
                            value={newDislikedItem}
                            onChange={(e) => setNewDislikedItem(e.target.value)}
                        />
                        <Button size="icon" onClick={addDisliked}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {disliked.map(item => (
                            <div key={item.id} className="flex items-center gap-1 bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm">
                                <span>{item.ingredient_name}</span>
                                <button onClick={() => removeDisliked(item.id)} className="ml-1">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Preferences
            </Button>
        </div>
    );
};