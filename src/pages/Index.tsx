import { useState } from "react";
import { LandingPage } from "@/components/LandingPage";
import { Quiz } from "@/components/Quiz";
import { Dashboard } from "@/components/Dashboard";

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
  const [appState, setAppState] = useState<AppState>('landing');
  const [userProfile, setUserProfile] = useState<QuizData | null>(null);

  const handleStartQuiz = () => {
    setAppState('quiz');
  };

  const handleQuizComplete = (data: QuizData) => {
    setUserProfile(data);
    setAppState('dashboard');
  };

  const handleBackToLanding = () => {
    setAppState('landing');
  };

  const handleBackToQuiz = () => {
    setAppState('quiz');
  };

  if (appState === 'quiz') {
    return (
      <Quiz 
        onComplete={handleQuizComplete} 
        onBack={handleBackToLanding}
      />
    );
  }

  if (appState === 'dashboard' && userProfile) {
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
