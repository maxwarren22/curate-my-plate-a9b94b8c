import { useState, useEffect } from "react";
import { LandingPage } from "@/components/LandingPage";
import { Quiz } from "@/components/Quiz";
import { Dashboard } from "@/components/Dashboard";
import { AuthPage } from "@/components/AuthPage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AppState = 'landing' | 'quiz' | 'dashboard';

interface QuizData {
  dietaryRestrictions: string[];
  mealTypes: string[];
  cookingTime: string;
  cuisinePreferences: string[];
  skillLevel: string;
  servingSize: string;
  budget: string;
}

const Index = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [appState, setAppState] = useState<AppState>('landing');
  const [userProfile, setUserProfile] = useState<QuizData | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // Load user profile when authenticated
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      if (profile && profile.dietary_restrictions) {
        // Convert profile data to QuizData format
        const profileData: QuizData = {
          dietaryRestrictions: profile.dietary_restrictions || [],
          mealTypes: profile.meal_types || [],
          cookingTime: profile.cooking_time || '',
          cuisinePreferences: profile.cuisine_preferences || [],
          skillLevel: profile.skill_level || '',
          servingSize: profile.serving_size || '',
          budget: profile.budget || '',
        };
        setUserProfile(profileData);
        setAppState('dashboard');
      } else {
        // User exists but no quiz data, start with quiz
        setAppState('quiz');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleStartQuiz = () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    setAppState('quiz');
  };

  const handleQuizComplete = async (data: QuizData) => {
    if (!user) return;

    try {
      // Save quiz data to user profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          dietary_restrictions: data.dietaryRestrictions,
          meal_types: data.mealTypes,
          cooking_time: data.cookingTime,
          cuisine_preferences: data.cuisinePreferences,
          skill_level: data.skillLevel,
          serving_size: data.servingSize,
          budget: data.budget,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving profile:', error);
        toast({
          title: "Error saving preferences",
          description: "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      setUserProfile(data);
      setAppState('dashboard');
      toast({
        title: "Preferences saved!",
        description: "Your meal plan is being generated.",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save your preferences.",
        variant: "destructive",
      });
    }
  };

  const handleBackToLanding = () => {
    setAppState('landing');
  };

  const handleBackToQuiz = () => {
    setAppState('quiz');
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
    // User profile will be loaded by useEffect
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showAuth) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (appState === 'quiz') {
    return (
      <Quiz 
        onComplete={handleQuizComplete} 
        onBack={handleBackToLanding}
      />
    );
  }

  if (appState === 'dashboard' && userProfile && user) {
    return (
      <Dashboard 
        userProfile={userProfile}
        onBackToQuiz={handleBackToQuiz}
      />
    );
  }

  return (
    <LandingPage onStartQuiz={handleStartQuiz} />
  );
};

export default Index;
