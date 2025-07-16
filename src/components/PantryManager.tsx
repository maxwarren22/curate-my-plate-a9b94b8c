import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus } from "lucide-react";

interface PantryItem {
  id: string;
  ingredient_name: string;
  quantity: string;
  expiry_date?: string;
}

interface PantryManagerProps {
  onPantryChange: (items: PantryItem[]) => void;
}

export const PantryManager = ({ onPantryChange }: PantryManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [newPantryItem, setNewPantryItem] = useState({ name: '', quantity: '', expiry: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadPantryData();
    }
  }, [user]);

  const loadPantryData = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const itemsWithQuantity = data.map(item => ({ ...item, quantity: item.quantity || '1' }));
        setPantryItems(itemsWithQuantity);
        onPantryChange(itemsWithQuantity);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load pantry items", variant: "destructive" });
    }
  };

  const addPantryItem = async () => {
    if (!user || !newPantryItem.name.trim()) return;
    setLoading(true);
    try {
      await supabase
        .from('pantry_items')
        .insert({
          user_id: user.id,
          ingredient_name: newPantryItem.name.trim(),
          quantity: newPantryItem.quantity || '1',
          expiry_date: newPantryItem.expiry || null,
        });
      setNewPantryItem({ name: '', quantity: '', expiry: '' });
      await loadPantryData();
      toast({ title: "Success", description: "Ingredient added to pantry" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add ingredient", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updatePantryItemQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removePantryItem(id);
      return;
    }
    try {
      await supabase.from('pantry_items').update({ quantity: newQuantity.toString() }).eq('id', id);
      await loadPantryData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update quantity", variant: "destructive" });
    }
  };

  const removePantryItem = async (id: string) => {
    try {
      await supabase.from('pantry_items').delete().eq('id', id);
      await loadPantryData();
      toast({ title: "Success", description: "Ingredient removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove ingredient", variant: "destructive" });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-primary">
          Manage Your Pantry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Add Pantry Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="ingredient-name">Ingredient</Label>
              <Input
                id="ingredient-name"
                placeholder="e.g., Onions"
                value={newPantryItem.name}
                onChange={(e) => setNewPantryItem(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity (optional)</Label>
              <Input
                id="quantity"
                placeholder="e.g., 2"
                value={newPantryItem.quantity}
                onChange={(e) => setNewPantryItem(prev => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="expiry">Expiry (optional)</Label>
              <Input
                id="expiry"
                type="date"
                value={newPantryItem.expiry}
                onChange={(e) => setNewPantryItem(prev => ({ ...prev, expiry: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addPantryItem} disabled={loading || !newPantryItem.name.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Current Pantry Items</h3>
          {pantryItems.length === 0 ? (
            <p className="text-muted-foreground">No pantry items yet. Add some ingredients above!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pantryItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <p className="font-medium">{item.ingredient_name}</p>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => updatePantryItemQuantity(item.id, parseInt(item.quantity) - 1)}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span>{item.quantity}</span>
                    <Button size="icon" variant="ghost" onClick={() => updatePantryItemQuantity(item.id, parseInt(item.quantity) + 1)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removePantryItem(item.id)} disabled={loading}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
