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
    budget: ''
  });

  const totalSteps = 7;
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
    if (checked) {
      setQuizData(prev => ({
        ...prev,
        dietaryRestrictions: [...prev.dietaryRestrictions, restriction]
      }));
    } else {
      setQuizData(prev => ({
        ...prev,
        dietaryRestrictions: prev.dietaryRestrictions.filter(r => r !== restriction)
      }));
    }
  };

  const handleMealTypeChange = (mealType: string, checked: boolean) => {
    if (checked) {
      setQuizData(prev => ({
        ...prev,
        mealTypes: [...prev.mealTypes, mealType]
      }));
    } else {
      setQuizData(prev => ({
        ...prev,
        mealTypes: prev.mealTypes.filter(m => m !== mealType)
      }));
    }
  };

  const handleCuisineChange = (cuisine: string, checked: boolean) => {
    if (checked) {
      setQuizData(prev => ({
        ...prev,
        cuisinePreferences: [...prev.cuisinePreferences, cuisine]
      }));
    } else {
      setQuizData(prev => ({
        ...prev,
        cuisinePreferences: prev.cuisinePreferences.filter(c => c !== cuisine)
      }));
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Do you have any dietary restrictions?</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'None'].map((restriction) => (
                  <div key={restriction} className="flex items-center space-x-2">
                    <Checkbox
                      id={restriction}
                      checked={quizData.dietaryRestrictions.includes(restriction)}
                      onCheckedChange={(checked) => handleDietaryChange(restriction, checked as boolean)}
                    />
                    <Label htmlFor={restriction}>{restriction}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">What meals would you like planned?</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((mealType) => (
                  <div key={mealType} className="flex items-center space-x-2">
                    <Checkbox
                      id={mealType}
                      checked={quizData.mealTypes.includes(mealType)}
                      onCheckedChange={(checked) => handleMealTypeChange(mealType, checked as boolean)}
                    />
                    <Label htmlFor={mealType}>{mealType}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">How much time do you have for cooking?</h3>
            <RadioGroup
              value={quizData.cookingTime}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, cookingTime: value }))}
            >
              {['15 minutes or less', '15-30 minutes', '30-60 minutes', '1+ hours', 'No preference'].map((time) => (
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
            <div>
              <h3 className="text-xl font-semibold mb-4">What cuisines do you enjoy?</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian', 'French', 'Thai'].map((cuisine) => (
                  <div key={cuisine} className="flex items-center space-x-2">
                    <Checkbox
                      id={cuisine}
                      checked={quizData.cuisinePreferences.includes(cuisine)}
                      onCheckedChange={(checked) => handleCuisineChange(cuisine, checked as boolean)}
                    />
                    <Label htmlFor={cuisine}>{cuisine}</Label>
                  </div>
                ))}
              </div>
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
              {['Beginner', 'Intermediate', 'Advanced', 'Professional'].map((skill) => (
                <div key={skill} className="flex items-center space-x-2">
                  <RadioGroupItem value={skill} id={skill} />
                  <Label htmlFor={skill}>{skill}</Label>
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
              {['1 person', '2 people', '3-4 people', '5+ people'].map((size) => (
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
            <h3 className="text-xl font-semibold mb-4">What's your weekly food budget?</h3>
            <RadioGroup
              value={quizData.budget}
              onValueChange={(value) => setQuizData(prev => ({ ...prev, budget: value }))}
            >
              {['Under $50', '$50-$100', '$100-$150', '$150+', 'No budget constraints'].map((budget) => (
                <div key={budget} className="flex items-center space-x-2">
                  <RadioGroupItem value={budget} id={budget} />
                  <Label htmlFor={budget}>{budget}</Label>
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