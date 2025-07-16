import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface QuizData {
  dietaryRestrictions: string[];
  mealTypes: string[];
  cookingTime: string;
  cuisinePreferences: string[];
  skillLevel: string;
  servingSize: string;
  budget: string;
  healthGoals: string; // New field
}

interface QuizProps {
  onComplete: (data: QuizData) => void;
  onBack: () => void;
}

export const Quiz = ({ onComplete, onBack }: QuizProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [quizData, setQuizData] = useState<QuizData>({
    dietaryRestrictions: [],
    mealTypes: [],
    cookingTime: '',
    cuisinePreferences: [],
    skillLevel: '',
    servingSize: '',
    budget: '',
    healthGoals: '', // New field
  });

  const totalSteps = 8; // Increased from 7
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(quizData);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };
  
  // ... (handleDietaryChange, handleMealTypeChange, handleCuisineChange are correct)

  const renderStep = () => {
    switch (currentStep) {
      // ... (Cases 0 through 6 are correct)
      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">What are your health & fitness goals?</h3>
            <RadioGroup
              value={quizData.healthGoals}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, healthGoals: value }))}
            >
              {['Weight Loss', 'Muscle Gain', 'General Wellness', 'Heart Health', 'No Specific Goal'].map((goal) => (
                <div key={goal} className="flex items-center space-x-2">
                  <RadioGroupItem value={goal} id={goal} />
                  <Label htmlFor={goal}>{goal}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-large border-0">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold text-primary">
            Let's Build Your Perfect Meal Plan
          </CardTitle>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Step {currentStep + 1} of {totalSteps}
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {renderStep()}
          
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              className="px-6"
            >
              {currentStep === 0 ? 'Back to Home' : 'Previous'}
            </Button>
            
            <Button
              variant="default"
              onClick={handleNext}
              className="px-6"
            >
              {currentStep === totalSteps - 1 ? 'Generate My Meal Plan' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};