import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, Upload, Loader2 } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { DEFAULT_CATEGORIES } from "@shared/appTypes";

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTransaction?: {
    id: number;
    type: "income" | "expense";
    amount: string;
    category: string;
    description: string | null;
    merchant: string | null;
    date: number;
  } | null;
}

export function TransactionModal({ open, onOpenChange, editTransaction }: TransactionModalProps) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();
  const createMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      toast.success(editTransaction ? "Transaction updated" : "Transaction added");
      utils.transactions.list.invalidate();
      utils.analytics.dailyBalances.invalidate();
      utils.analytics.monthlyTotals.invalidate();
      utils.analytics.categoryBreakdown.invalidate();
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => {
      toast.success("Transaction updated");
      utils.transactions.list.invalidate();
      utils.analytics.dailyBalances.invalidate();
      utils.analytics.monthlyTotals.invalidate();
      utils.analytics.categoryBreakdown.invalidate();
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const uploadMutation = trpc.receipt.upload.useMutation();
  const scanMutation = trpc.receipt.scan.useMutation();

  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setAmount(editTransaction.amount);
      setCategory(editTransaction.category);
      setDescription(editTransaction.description ?? "");
      setMerchant(editTransaction.merchant ?? "");
      setDate(new Date(editTransaction.date).toISOString().split("T")[0]);
    } else {
      resetForm();
    }
  }, [editTransaction, open]);

  function resetForm() {
    setType("expense");
    setAmount("");
    setCategory("");
    setDescription("");
    setMerchant("");
    setDate(new Date().toISOString().split("T")[0]);
  }

  async function handleReceiptUpload(file: File) {
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File too large. Max 16MB.");
      return;
    }
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const { signedUrl } = await uploadMutation.mutateAsync({
        base64,
        mimeType: file.type,
        fileName: file.name,
      });
      const result = await scanMutation.mutateAsync({ imageUrl: signedUrl });
      setMerchant(result.merchant);
      setAmount(result.amount);
      setCategory(result.category);
      if (result.date) setDate(result.date);
      toast.success("Receipt scanned successfully!");
    } catch (err: any) {
      toast.error("Failed to scan receipt: " + (err.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  }

  function handleSubmit() {
    if (!amount || !category) {
      toast.error("Amount and category are required");
      return;
    }
    const dateMs = new Date(date + "T12:00:00").getTime();
    if (editTransaction) {
      updateMutation.mutate({
        id: editTransaction.id,
        type,
        amount,
        category,
        description: description || undefined,
        merchant: merchant || undefined,
        date: dateMs,
      });
    } else {
      createMutation.mutate({
        type,
        amount,
        category,
        description: description || undefined,
        merchant: merchant || undefined,
        date: dateMs,
      });
    }
  }

  const filteredCategories = (categories ?? []).filter(c =>
    c.type === "both" || c.type === type
  );
  const defaultCats = DEFAULT_CATEGORIES.filter(c => c.type === "both" || c.type === type);
  const allCats = filteredCategories.length > 0 ? filteredCategories : defaultCats.map((c, i) => ({ id: i, name: c.name, icon: c.icon, color: c.color, type: c.type, userId: null, isDefault: true, createdAt: new Date() }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {editTransaction ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Receipt Scanner */}
          {!editTransaction && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={scanning}
                onClick={() => fileInputRef.current?.click()}
              >
                {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                {scanning ? "Scanning..." : "Scan Receipt"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReceiptUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {/* Type Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${type === "expense" ? "bg-destructive/20 text-destructive" : "bg-secondary text-muted-foreground"}`}
              onClick={() => setType("expense")}
            >
              Expense
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${type === "income" ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}
              onClick={() => setType("income")}
            >
              Income
            </button>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-secondary"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-secondary">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {allCats.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    <div className="flex items-center gap-2">
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      <span>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Merchant */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Merchant / Source</Label>
            <Input
              placeholder="e.g., Walmart, Salary"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="bg-secondary"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Description</Label>
            <Textarea
              placeholder="Optional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary resize-none"
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editTransaction ? "Update Transaction" : "Add Transaction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
