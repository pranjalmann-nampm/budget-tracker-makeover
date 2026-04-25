import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { PALETTES, CURRENCIES, DEFAULT_CATEGORIES } from "@shared/appTypes";
import type { PaletteKey } from "@shared/appTypes";
import { CategoryIcon } from "@/components/CategoryIcon";
import { toast } from "sonner";
import { Palette, Sun, Moon, DollarSign, Bell, Tag, Plus, Trash2, Check } from "lucide-react";

export default function Settings() {
  const { theme, palette, setTheme, setPalette } = useTheme();
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      utils.settings.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const createCategory = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Category added");
      utils.categories.list.invalidate();
      setNewCatName("");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteCategory = trpc.categories.delete.useMutation({
    onSuccess: () => {
      toast.success("Category removed");
      utils.categories.list.invalidate();
    },
  });

  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"expense" | "income" | "both">("expense");

  function handlePaletteChange(key: PaletteKey) {
    setPalette(key);
    updateSettings.mutate({ palette: key });
  }

  function handleThemeToggle() {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    updateSettings.mutate({ theme: newTheme });
  }

  function handleCurrencyChange(code: string) {
    updateSettings.mutate({ currency: code });
  }

  function handleNotificationToggle(field: "notificationsEnabled" | "notifyOnLargeExpense", value: boolean) {
    updateSettings.mutate({ [field]: value });
  }

  function handleAddCategory() {
    if (!newCatName.trim()) return;
    createCategory.mutate({
      name: newCatName.trim(),
      icon: "Tag",
      color: "#6b7280",
      type: newCatType,
    });
  }

  const customCategories = (categories ?? []).filter(c => !c.isDefault && c.userId !== null);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize your experience</p>
      </div>

      {/* Theme & Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>Choose your preferred theme and color palette</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dark/Light Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Toggle between dark and light themes</p>
              </div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={handleThemeToggle} />
          </div>

          <Separator />

          {/* Palette Picker */}
          <div>
            <p className="text-sm font-medium mb-3">Color Palette</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(PALETTES) as [PaletteKey, typeof PALETTES[PaletteKey]][]).map(([key, p]) => (
                <button
                  key={key}
                  className={`relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${palette === key ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  onClick={() => handlePaletteChange(key)}
                >
                  <div className="flex gap-1">
                    <div className="h-6 w-6 rounded-full" style={{ background: p.primary }} />
                    <div className="h-6 w-6 rounded-full" style={{ background: p.chart1 }} />
                    <div className="h-6 w-6 rounded-full" style={{ background: p.chart5 }} />
                  </div>
                  <span className="text-sm font-medium">{p.label}</span>
                  {palette === key && (
                    <Check className="h-4 w-4 text-primary absolute top-2 right-2" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Currency
          </CardTitle>
          <CardDescription>Set your default currency for displaying amounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={settings?.currency ?? "USD"} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-full bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>Configure your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Notifications</p>
              <p className="text-xs text-muted-foreground">Receive alerts about your finances</p>
            </div>
            <Switch
              checked={settings?.notificationsEnabled ?? true}
              onCheckedChange={(v) => handleNotificationToggle("notificationsEnabled", v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Large Expense Alerts</p>
              <p className="text-xs text-muted-foreground">Get notified for expenses above threshold</p>
            </div>
            <Switch
              checked={settings?.notifyOnLargeExpense ?? true}
              onCheckedChange={(v) => handleNotificationToggle("notifyOnLargeExpense", v)}
            />
          </div>
          {settings?.notifyOnLargeExpense && (
            <div>
              <Label className="text-xs text-muted-foreground">Threshold Amount</Label>
              <Input
                type="number"
                className="bg-secondary mt-1.5 w-[200px]"
                defaultValue={settings?.largeExpenseThreshold ?? "100.00"}
                onBlur={(e) => updateSettings.mutate({ largeExpenseThreshold: e.target.value })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Categories
          </CardTitle>
          <CardDescription>Manage your transaction categories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default Categories */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Default Categories</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEFAULT_CATEGORIES.map(c => (
                <div key={c.name} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="text-xs font-medium">{c.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Categories */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Custom Categories</p>
            {customCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom categories yet</p>
            ) : (
              <div className="space-y-2">
                {customCategories.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      <span className="text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">({c.type})</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory.mutate({ id: c.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Add Category */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="bg-secondary mt-1"
              />
            </div>
            <div className="w-[120px]">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={newCatType} onValueChange={(v) => setNewCatType(v as any)}>
                <SelectTrigger className="bg-secondary mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAddCategory} disabled={!newCatName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
