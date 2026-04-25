import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/hooks/useCurrency";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionModal } from "@/components/TransactionModal";
import { DEFAULT_CATEGORIES } from "@shared/appTypes";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, ArrowUpDown,
  Trash2, Pencil, Download, Upload, FileJson, FileSpreadsheet,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 15;

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { formatSigned } = useCurrency();
  const utils = trpc.useUtils();

  const queryInput = useMemo(() => ({
    search: search || undefined,
    type: typeFilter !== "all" ? typeFilter as "income" | "expense" : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    startDate: startDate ? new Date(startDate + "T00:00:00").getTime() : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59").getTime() : undefined,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [search, typeFilter, categoryFilter, startDate, endDate, sortBy, sortDir, page]);

  const { data, isLoading } = trpc.transactions.list.useQuery(queryInput);
  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Transaction deleted");
      utils.transactions.list.invalidate();
      utils.analytics.dailyBalances.invalidate();
      utils.analytics.monthlyTotals.invalidate();
      utils.analytics.categoryBreakdown.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: exportData } = trpc.transactions.exportAll.useQuery(undefined, { enabled: false });
  const importMutation = trpc.transactions.bulkImport.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} transactions`);
      utils.transactions.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const items = data?.items ?? [];

  function getCatInfo(name: string) {
    return DEFAULT_CATEGORIES.find(c => c.name === name) ?? { icon: "MoreHorizontal", color: "#6b7280" };
  }

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir(col === "amount" ? "desc" : "asc"); }
    setPage(0);
  }

  async function handleExportJSON() {
    const result = await utils.transactions.exportAll.fetch();
    const blob = new Blob([JSON.stringify({ transactions: result }, null, 2)], { type: "application/json" });
    downloadBlob(blob, "budget_data.json");
    toast.success("JSON exported!");
  }

  async function handleExportCSV() {
    const result = await utils.transactions.exportAll.fetch();
    const lines = ["Date,Type,Category,Amount,Merchant,Description"];
    result.forEach((t) => {
      const d = new Date(t.date).toISOString().split("T")[0];
      const desc = (t.description || "").replace(/"/g, '""');
      const merch = (t.merchant || "").replace(/"/g, '""');
      lines.push(`${d},${t.type},"${t.category}",${t.amount},"${merch}","${desc}"`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    downloadBlob(blob, "budget_data.csv");
    toast.success("CSV exported!");
  }

  function downloadBlob(blob: Blob, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text);
          const txs = data.transactions || data;
          if (!Array.isArray(txs)) throw new Error("Invalid format");
          const items = txs.map((t: any) => ({
            type: t.type as "income" | "expense",
            amount: String(t.amount),
            category: t.category || "Other",
            description: t.description,
            merchant: t.merchant,
            date: typeof t.date === "number" ? t.date : new Date(t.date).getTime(),
          }));
          importMutation.mutate({ items });
        } else {
          const lines = text.trim().split("\n");
          const items = lines.slice(1).map((line: string) => {
            const parts = line.match(/(".*?"|[^,]+)/g) || [];
            const clean = (s: string) => s.replace(/^"|"$/g, "").replace(/""/g, '"');
            return {
              type: (clean(parts[1] || "expense")) as "income" | "expense",
              amount: clean(parts[3] || "0"),
              category: clean(parts[2] || "Other"),
              description: clean(parts[5] || ""),
              merchant: clean(parts[4] || ""),
              date: new Date(clean(parts[0] || "")).getTime(),
            };
          }).filter((t: { date: number }) => !isNaN(t.date));
          importMutation.mutate({ items });
        }
      } catch (err: any) {
        toast.error("Import failed: " + err.message);
      }
    };
    input.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.total ?? 0} total transactions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <FileJson className="h-3.5 w-3.5 mr-1.5" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button size="sm" onClick={() => { setEditTx(null); setShowModal(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 bg-secondary"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
              className="w-[140px] bg-secondary text-sm"
              placeholder="From"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
              className="w-[140px] bg-secondary text-sm"
              placeholder="To"
            />
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {DEFAULT_CATEGORIES.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("date")}>
                    <span className="flex items-center gap-1">Date {sortBy === "date" && <ArrowUpDown className="h-3 w-3" />}</span>
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Description</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("amount")}>
                    <span className="flex items-center justify-end gap-1">Amount {sortBy === "amount" && <ArrowUpDown className="h-3 w-3" />}</span>
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No transactions found</td></tr>
                ) : items.map(tx => {
                  const cat = getCatInfo(tx.category);
                  return (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="text-sm">{new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                          <span className="text-sm">{tx.category}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm truncate max-w-[200px]">{tx.merchant || tx.description || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${tx.type === "income" ? "text-success" : "text-destructive"}`}>
                          {formatSigned(tx.amount, tx.type)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTx(tx); setShowModal(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(tx.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAB */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg shadow-primary/25 z-50"
        size="icon"
        onClick={() => { setEditTx(null); setShowModal(true); }}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <TransactionModal open={showModal} onOpenChange={setShowModal} editTransaction={editTx} />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Are you sure you want to delete this transaction?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
