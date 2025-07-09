import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { LandingPage } from "@/components/LandingPage";
import { AuthPage } from "@/components/AuthPage";
import { Quiz } from "@/components/Quiz";
import { Dashboard } from "@/components/Dashboard";
import { Skeleton } from "@/components/ui/skeleton";

// This interface defines the data structure used within the React app (camelCase)
interface QuizData {
  dietaryRestrictions: string[];
  mealTypes: string[];
  cookingTime: string;
  cuisinePreferences: string[];
  skillLevel: string;
  servingSize: string;
  budget: string;
}

// Define the possible states for the main application view
type AppState = 'loading' | 'auth' | 'quiz' | 'dashboard' | 'landing';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [appState, setAppState] = useState<AppState>('loading');
  const [userProfile, setUserProfile] = useState<QuizData | null>(null);

  const checkUserProfile = useCallback(async () => {
    if (!user) {
      setAppState('landing');
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (profile) {
        // ** THE FIX IS HERE: Map snake_case from DB to camelCase for the app **
        const mappedProfile: QuizData = {
          dietaryRestrictions: profile.dietary_restrictions || [],
          mealTypes: profile.meal_types || [],
          cookingTime: profile.cooking_time || '',
          cuisinePreferences: profile.cuisine_preferences || [],
          skillLevel: profile.skill_level || '',
          servingSize: profile.serving_size || '',
          budget: profile.budget || '',
        };
        setUserProfile(mappedProfile);
        setAppState('dashboard');
      } else {
        setAppState('quiz');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        title: "Error loading profile",
        description: `Could not fetch your preferences: ${errorMessage}`,
        variant: "destructive",
      });
      setAppState('landing');
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) {
      checkUserProfile();
    }
  }, [user, authLoading, checkUserProfile]);

  const handleStart = () => {
    setAppState(user ? 'quiz' : 'auth');
  };

  const handleAuthSuccess = () => {
    setAppState('loading');
  };

  const handleQuizComplete = async (data: QuizData) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be signed in to save preferences.", variant: "destructive" });
      return;
    }

    try {
      // When saving to the DB, map from camelCase back to snake_case
      const { error } = await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          dietary_restrictions: data.dietaryRestrictions,
          meal_types: data.mealTypes,
          cooking_time: data.cookingTime,
          cuisine_preferences: data.cuisinePreferences,
          skill_level: data.skillLevel,
          serving_size: data.servingSize,
          budget: data.budget,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      setUserProfile(data);
      setAppState('dashboard');
      toast({ title: "Preferences Saved!", description: "Welcome to your dashboard." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        title: "Error Saving Preferences",
        description: `Failed to save your quiz data: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // --- Component Rendering Logic ---

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  switch (appState) {
    case 'auth':
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    case 'quiz':
      return <Quiz onComplete={handleQuizComplete} onBack={() => setAppState('landing')} />;
    case 'dashboard':
      return userProfile ? <Dashboard userProfile={userProfile} onBackToQuiz={() => setAppState('quiz')} /> : null;
    case 'landing':
    default:
      return <LandingPage onStartQuiz={handleStart} />;
  }
};

export default Index;
