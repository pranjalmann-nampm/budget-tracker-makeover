import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/hooks/useCurrency";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionModal } from "@/components/TransactionModal";
import { DEFAULT_CATEGORIES } from "@shared/appTypes";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Plus, TrendingUp, TrendingDown, Eye, EyeOff,
} from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { format, formatSigned } = useCurrency();
  const [, setLocation] = useLocation();

  const now = useMemo(() => Date.now(), []);
  const startOfMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const { data: txData } = trpc.transactions.list.useQuery({
    limit: 10,
    sortBy: "date",
    sortDir: "desc",
  });

  const { data: monthTx } = trpc.transactions.list.useQuery({
    startDate: startOfMonth,
    endDate: now,
    limit: 100,
  });

  const stats = useMemo(() => {
    const items = monthTx?.items ?? [];
    let income = 0, expense = 0;
    items.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === "income") income += amt;
      else expense += amt;
    });
    return { income, expense, balance: income - expense };
  }, [monthTx]);

  const recentTransactions = txData?.items ?? [];

  function getCatInfo(name: string) {
    return DEFAULT_CATEGORIES.find(c => c.name === name) ?? { icon: "MoreHorizontal", color: "#6b7280" };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Total Balance</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBalanceVisible(!balanceVisible)}>
              {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {balanceVisible ? (
              <span className={stats.balance >= 0 ? "text-foreground" : "text-destructive"}>
                {stats.balance >= 0 ? "" : "-"}{format(Math.abs(stats.balance))}
              </span>
            ) : (
              <span className="text-muted-foreground">••••••</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </CardContent>
      </Card>

      {/* Income / Expense Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-success/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Income</p>
                <p className="text-2xl font-bold text-success mt-1">{format(stats.income)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expenses</p>
                <p className="text-2xl font-bold text-destructive mt-1">{format(stats.expense)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={() => setLocation("/transactions")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No transactions yet. Add your first one!
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTransactions.map(tx => {
                const cat = getCatInfo(tx.category);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => setLocation("/transactions")}>
                    <CategoryIcon icon={cat.icon} color={cat.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.merchant || tx.category}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === "income" ? "text-success" : "text-destructive"}`}>
                      {formatSigned(tx.amount, tx.type)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAB */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg shadow-primary/25 z-50"
        size="icon"
        onClick={() => setShowModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <TransactionModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}
