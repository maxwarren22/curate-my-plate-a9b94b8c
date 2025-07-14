import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Info, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// This is a placeholder for subscription data you would fetch
const subscriptionData = {
    planName: "Trial Plan",
    renewalDate: "N/A",
    generationsRemaining: 3,
    totalGenerations: 5,
};

export const AccountView = () => {
    const { user } = useAuth();

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
                <Button variant="ghost" size="icon">
                    <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                    <ExternalLink className="h-4 w-4" />
                </Button>
            </div>

            <Separator />

            {/* Subscription Card */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{subscriptionData.planName}</CardTitle>
                            <CardDescription>
                                {subscriptionData.renewalDate !== "N/A" 
                                    ? `Renewal date: ${subscriptionData.renewalDate}` 
                                    : "Upgrade to a Pro plan for more features."}
                            </CardDescription>
                        </div>
                        <Button>Upgrade</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-medium flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Trial Generations
                                </p>
                                <p className="text-sm font-semibold">
                                    {subscriptionData.generationsRemaining} / {subscriptionData.totalGenerations}
                                </p>
                            </div>
                            <Progress value={(subscriptionData.generationsRemaining / subscriptionData.totalGenerations) * 100} />
                        </div>
                        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md">
                            Your trial includes a limited number of meal plan generations. Upgrade to get unlimited generations.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
