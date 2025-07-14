import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Loader2 } from 'lucide-react';

// Define options for the form
const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'None'];
const cuisineOptions = ['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian'];
const timeOptions = ['15-30 minutes', '30-60 minutes', '1+ hours'];
const skillOptions = ['Beginner', 'Intermediate', 'Advanced'];

export const PreferencesForm = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // State for user preferences
    const [dietary, setDietary] = useState<string[]>([]);
    const [cuisine, setCuisine] = useState<string[]>([]);
    const [cookingTime, setCookingTime] = useState<string>('');
    const [skillLevel, setSkillLevel] = useState<string>('');
    
    // State for disliked ingredients
    const [disliked, setDisliked] = useState<{ id: string; ingredient_name: string }[]>([]);
    const [newDislikedItem, setNewDislikedItem] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                
                if (profileError) throw profileError;

                if (profile) {
                    setDietary(profile.dietary_restrictions || []);
                    setCuisine(profile.cuisine_preferences || []);
                    setCookingTime(profile.cooking_time || '');
                    setSkillLevel(profile.skill_level || '');
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
    }, [user, toast]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                dietary_restrictions: dietary,
                cuisine_preferences: cuisine,
                cooking_time: cookingTime,
                skill_level: skillLevel,
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