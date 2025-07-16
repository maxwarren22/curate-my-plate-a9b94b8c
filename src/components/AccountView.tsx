import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Copy, ExternalLink, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionStatus {
    status: 'trial' | 'active';
    planType?: string;
    generations_remaining: number | null;
    currentPeriodEnd?: string;
}

export const AccountView = () => {
    const { user, session } = useAuth();
    const { toast } = useToast();
    const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
    const [generationDay, setGenerationDay] = useState<string>('Sunday');
    const [loading, setLoading] = useState(true);

    const checkSubscription = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('check-subscription');
            if (error) throw error;
            setSubscription(data);
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch subscription details.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [session, toast]);

    const loadProfileData = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('plan_generation_day')
                .eq('user_id', user.id)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setGenerationDay(data.plan_generation_day || 'Sunday');
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch profile settings.", variant: "destructive" });
        }
    }, [user, toast]);

    useEffect(() => {
        checkSubscription();
        loadProfileData();
    }, [checkSubscription, loadProfileData]);

    const handleDayChange = async (day: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ plan_generation_day: day })
                .eq('user_id', user.id);
            if (error) throw error;
            setGenerationDay(day);
            toast({ title: "Success", description: "Your meal plan generation day has been updated." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update your preference.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold">Account</h3>

            {/* User Info Section */}
            <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback>{user?.user_metadata?.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <p className="text-lg font-semibold">{user?.user_metadata?.display_name || "User"}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
            </div>

            <Separator />

            {/* Subscription Card */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>
                                {subscription?.status === 'active' ? 'Pro Plan' : 'Trial Plan'}
                            </CardTitle>
                            <CardDescription>
                                {subscription?.status === 'active' && subscription.currentPeriodEnd
                                    ? `Renewal date: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` 
                                    : "Upgrade to a Pro plan for more features."}
                            </CardDescription>
                        </div>
                        <Button>
                            {subscription?.status === 'active' ? 'Manage Subscription' : 'Upgrade'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p>Loading subscription details...</p>
                    ) : subscription?.status === 'trial' ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-medium flex items-center gap-1">
                                        <Star className="h-3 w-3 text-yellow-500" />
                                        Trial Generations
                                    </p>
                                    <p className="text-sm font-semibold">
                                        {subscription.generations_remaining} / 3
                                    </p>
                                </div>
                                <Progress value={(subscription.generations_remaining || 0) / 3 * 100} />
                            </div>
                            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md">
                                Your trial includes a limited number of meal plan generations. Upgrade to get unlimited generations.
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">
                            You have unlimited meal plan generations with your Pro plan.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Separator />

            {/* Weekly Meal Plan Generation */}
            <Card>
                <CardHeader>
                    <CardTitle>Weekly Meal Plan Generation</CardTitle>
                    <CardDescription>
                        Choose which day of the week you'd like your new meal plan to be generated and emailed to you.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={generationDay} onValueChange={handleDayChange}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a day" />
                        </SelectTrigger>
                        <SelectContent>
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
    );
};
