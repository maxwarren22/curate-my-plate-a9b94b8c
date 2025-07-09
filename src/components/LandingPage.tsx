import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
interface LandingPageProps {
  onStartQuiz: () => void;
}
export const LandingPage = ({
  onStartQuiz
}: LandingPageProps) => {
  const {
    user
  } = useAuth();
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-20 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Curate My Plate</h1>
          {!user && <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={onStartQuiz}>
              Sign In
            </Button>}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Your Perfect
            <span className="block bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Meal Plan Awaits
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
            Discover personalized recipes tailored to your taste, dietary needs, and lifestyle. 
            Start your culinary journey today!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={onStartQuiz} variant="hero" size="lg" className="text-lg px-8 py-4 h-auto">
              Start Your Food Journey
            </Button>
            
            <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto bg-white/10 border-white/30 text-white hover:bg-white/20">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-foreground">
            Why Choose Our Meal Planning?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center shadow-soft hover:shadow-medium transition-all duration-300 border-0 bg-card">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-card-foreground">Personalized</h3>
                <p className="text-muted-foreground leading-relaxed">
                  AI-powered meal plans tailored to your dietary preferences, restrictions, and goals.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center shadow-soft hover:shadow-medium transition-all duration-300 border-0 bg-card">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-secondary rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-card-foreground">Convenient</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Weekly meal plans with shopping lists delivered right to your inbox.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center shadow-soft hover:shadow-medium transition-all duration-300 border-0 bg-card">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-warm rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-2xl">🍽️</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-card-foreground">Variety</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Discover new recipes while avoiding repetition with our smart recommendation system.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-warm">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Transform Your Meals?
          </h2>
          <p className="text-xl mb-8 text-white/90">
            Join thousands of happy users who've discovered the joy of stress-free meal planning.
          </p>
          <Button onClick={onStartQuiz} variant="hero" size="lg" className="text-lg px-8 py-4 h-auto bg-white text-primary hover:bg-white/90">
            Get Started Now
          </Button>
        </div>
      </section>
    </div>;
};