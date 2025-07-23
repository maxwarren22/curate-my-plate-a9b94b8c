import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Minus } from "lucide-react";

interface PantryItem {
  id: string;
  ingredient_name: string;
  quantity: string;
  expiry_date?: string;
}

interface PantryManagerProps {
  items: PantryItem[];
  onAddItem: (item: { name: string; quantity: string; expiry: string }) => Promise<void>;
  onUpdateItemQuantity: (id: string, newQuantity: number) => Promise<void>;
  onRemoveItem: (id: string) => Promise<void>;
  loading: boolean;
}

export const PantryManager = ({ items, onAddItem, onUpdateItemQuantity, onRemoveItem, loading }: PantryManagerProps) => {
  const [newPantryItem, setNewPantryItem] = useState({ name: '', quantity: '', expiry: '' });

  const handleAdd = async () => {
    await onAddItem(newPantryItem);
    setNewPantryItem({ name: '', quantity: '', expiry: '' });
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
              <Button onClick={handleAdd} disabled={loading || !newPantryItem.name.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Current Pantry Items</h3>
          {items.length === 0 ? (
            <p className="text-muted-foreground">No pantry items yet. Add some ingredients above!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <p className="font-medium">{item.ingredient_name}</p>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => onUpdateItemQuantity(item.id, parseInt(item.quantity) - 1)}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span>{item.quantity}</span>
                    <Button size="icon" variant="ghost" onClick={() => onUpdateItemQuantity(item.id, parseInt(item.quantity) + 1)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveItem(item.id)} disabled={loading}>
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
