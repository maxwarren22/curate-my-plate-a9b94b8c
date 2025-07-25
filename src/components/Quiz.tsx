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
  
  const handleDietaryChange = (restriction: string, checked: boolean) => {
    setQuizData(prev => ({
      ...prev,
      dietaryRestrictions: checked
        ? [...prev.dietaryRestrictions, restriction]
        : prev.dietaryRestrictions.filter(r => r !== restriction)
    }));
  };

  const handleMealTypeChange = (mealType: string, checked: boolean) => {
    setQuizData(prev => ({
      ...prev,
      mealTypes: checked
        ? [...prev.mealTypes, mealType]
        : prev.mealTypes.filter(m => m !== mealType)
    }));
  };

  const handleCuisineChange = (cuisine: string, checked: boolean) => {
    setQuizData(prev => ({
      ...prev,
      cuisinePreferences: checked
        ? [...prev.cuisinePreferences, cuisine]
        : prev.cuisinePreferences.filter(c => c !== cuisine)
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Do you have any dietary restrictions or preferences?</h3>
            <div className="grid grid-cols-2 gap-4">
              {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'None'].map((restriction) => (
                <div key={restriction} className="flex items-center space-x-2">
                  <Checkbox
                    id={restriction}
                    checked={quizData.dietaryRestrictions.includes(restriction)}
                    onCheckedChange={(checked) => handleDietaryChange(restriction, !!checked)}
                  />
                  <Label htmlFor={restriction}>{restriction}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">What meals would you like us to plan for you?</h3>
            <div className="grid grid-cols-2 gap-4">
              {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((meal) => (
                <div key={meal} className="flex items-center space-x-2">
                  <Checkbox
                    id={meal}
                    checked={quizData.mealTypes.includes(meal)}
                    onCheckedChange={(checked) => handleMealTypeChange(meal, !!checked)}
                  />
                  <Label htmlFor={meal}>{meal}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">How much time do you usually have for cooking?</h3>
            <RadioGroup
              value={quizData.cookingTime}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, cookingTime: value }))}
            >
              {['15 minutes or less', '15-30 minutes', '30-60 minutes', '1+ hours', 'I love spending time cooking'].map((time) => (
                <div key={time} className="flex items-center space-x-2">
                  <RadioGroupItem value={time} id={time} />
                  <Label htmlFor={time}>{time}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">What cuisines do you enjoy?</h3>
            <div className="grid grid-cols-2 gap-4">
              {['Italian', 'Asian', 'Mexican', 'Mediterranean', 'American', 'Indian', 'French', 'Middle Eastern'].map((cuisine) => (
                <div key={cuisine} className="flex items-center space-x-2">
                  <Checkbox
                    id={cuisine}
                    checked={quizData.cuisinePreferences.includes(cuisine)}
                    onCheckedChange={(checked) => handleCuisineChange(cuisine, !!checked)}
                  />
                  <Label htmlFor={cuisine}>{cuisine}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">What's your cooking skill level?</h3>
            <RadioGroup
              value={quizData.skillLevel}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, skillLevel: value }))}
            >
              {['Beginner', 'Intermediate', 'Advanced', 'Professional'].map((level) => (
                <div key={level} className="flex items-center space-x-2">
                  <RadioGroupItem value={level} id={level} />
                  <Label htmlFor={level}>{level}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">How many people are you cooking for?</h3>
            <RadioGroup
              value={quizData.servingSize}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, servingSize: value }))}
            >
              {['Just me (1)', 'Couple (2)', 'Small family (3-4)', 'Large family (5+)'].map((size) => (
                <div key={size} className="flex items-center space-x-2">
                  <RadioGroupItem value={size} id={size} />
                  <Label htmlFor={size}>{size}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">What's your weekly grocery budget?</h3>
            <RadioGroup
              value={quizData.budget}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, budget: value }))}
            >
              {['Under $50', '$50-$100', '$100-$150', '$150-$200', '$200+'].map((budget) => (
                <div key={budget} className="flex items-center space-x-2">
                  <RadioGroupItem value={budget} id={budget} />
                  <Label htmlFor={budget}>{budget}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
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