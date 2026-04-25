import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ===== Mock db module =====
vi.mock("./db", () => {
  const mockTransactions: any[] = [];
  let nextId = 1;

  return {
    ensureDefaultCategories: vi.fn().mockResolvedValue(undefined),

    getTransactions: vi.fn().mockImplementation(async (userId: number, opts: any) => {
      let items = mockTransactions.filter(t => t.userId === userId);
      if (opts?.type) items = items.filter((t: any) => t.type === opts.type);
      if (opts?.category) items = items.filter((t: any) => t.category === opts.category);
      if (opts?.search) {
        const q = opts.search.toLowerCase();
        items = items.filter((t: any) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.merchant || "").toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
      return { items: items.slice(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50)), total: items.length };
    }),

    getTransactionById: vi.fn().mockImplementation(async (id: number, userId: number) => {
      return mockTransactions.find(t => t.id === id && t.userId === userId) ?? null;
    }),

    createTransaction: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      mockTransactions.push({ id, ...data, createdAt: new Date(), updatedAt: new Date() });
      return id;
    }),

    updateTransaction: vi.fn().mockImplementation(async (id: number, userId: number, data: any) => {
      const idx = mockTransactions.findIndex(t => t.id === id && t.userId === userId);
      if (idx >= 0) Object.assign(mockTransactions[idx], data);
    }),

    deleteTransaction: vi.fn().mockImplementation(async (id: number, userId: number) => {
      const idx = mockTransactions.findIndex(t => t.id === id && t.userId === userId);
      if (idx >= 0) mockTransactions.splice(idx, 1);
    }),

    getAllTransactionsForExport: vi.fn().mockImplementation(async (userId: number) => {
      return mockTransactions.filter(t => t.userId === userId);
    }),

    bulkImportTransactions: vi.fn().mockImplementation(async (userId: number, items: any[]) => {
      items.forEach(item => {
        mockTransactions.push({ id: nextId++, userId, ...item, createdAt: new Date(), updatedAt: new Date() });
      });
      return items.length;
    }),

    getCategories: vi.fn().mockResolvedValue([
      { id: 1, name: "Food", icon: "UtensilsCrossed", color: "#f97316", type: "expense", userId: null, isDefault: true, createdAt: new Date() },
      { id: 2, name: "Income", icon: "Wallet", color: "#22c55e", type: "income", userId: null, isDefault: true, createdAt: new Date() },
    ]),

    createCategory: vi.fn().mockResolvedValue(100),

    deleteCategory: vi.fn().mockResolvedValue(undefined),

    getUserSettings: vi.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      theme: "dark",
      palette: "midnight-blue",
      currency: "USD",
      notificationsEnabled: true,
      notifyOnLargeExpense: true,
      largeExpenseThreshold: "100.00",
      updatedAt: new Date(),
    }),

    updateUserSettings: vi.fn().mockResolvedValue(undefined),

    getDailyBalances: vi.fn().mockResolvedValue([
      { day: "2026-04-20", income: "500.00", expense: "200.00" },
      { day: "2026-04-21", income: "0.00", expense: "50.00" },
    ]),

    getMonthlyTotals: vi.fn().mockResolvedValue([
      { month: "2026-03", income: "3000.00", expense: "2000.00" },
      { month: "2026-04", income: "4000.00", expense: "2500.00" },
    ]),

    getCategoryBreakdown: vi.fn().mockResolvedValue([
      { category: "Food", total: "500.00", count: 10 },
      { category: "Transport", total: "200.00", count: 5 },
    ]),
  };
});

// ===== Mock storage =====
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "receipts/1/test.jpg", url: "/manus-storage/receipts/1/test.jpg" }),
  storageGetSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com/receipt.jpg"),
}));

// ===== Mock LLM =====
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          merchant: "Walmart",
          amount: "42.50",
          date: "2026-04-25",
          category: "Shopping",
        }),
      },
    }],
  }),
}));

// ===== Helpers =====
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createCaller(userId = 1) {
  return appRouter.createCaller(createAuthContext(userId));
}

// ===== Tests =====

describe("transactions", () => {
  it("creates a transaction and returns an id", async () => {
    const caller = createCaller();
    const result = await caller.transactions.create({
      type: "expense",
      amount: "42.50",
      category: "Food",
      description: "Lunch",
      merchant: "Subway",
      date: Date.now(),
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("lists transactions with filters", async () => {
    const caller = createCaller();
    const result = await caller.transactions.list({
      type: "expense",
      limit: 10,
    });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("updates a transaction", async () => {
    const caller = createCaller();
    const { id } = await caller.transactions.create({
      type: "expense",
      amount: "25.00",
      category: "Transport",
      date: Date.now(),
    });
    const result = await caller.transactions.update({
      id,
      amount: "30.00",
      category: "Food",
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a transaction", async () => {
    const caller = createCaller();
    const { id } = await caller.transactions.create({
      type: "income",
      amount: "1000.00",
      category: "Income",
      date: Date.now(),
    });
    const result = await caller.transactions.delete({ id });
    expect(result).toEqual({ success: true });
  });

  it("exports all transactions", async () => {
    const caller = createCaller();
    const result = await caller.transactions.exportAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("bulk imports transactions", async () => {
    const caller = createCaller();
    const result = await caller.transactions.bulkImport({
      items: [
        { type: "expense", amount: "10.00", category: "Food", date: Date.now() },
        { type: "income", amount: "500.00", category: "Income", date: Date.now() },
      ],
    });
    expect(result).toEqual({ imported: 2 });
  });
});

describe("categories", () => {
  it("lists categories", async () => {
    const caller = createCaller();
    const result = await caller.categories.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("icon");
    expect(result[0]).toHaveProperty("color");
  });

  it("creates a custom category", async () => {
    const caller = createCaller();
    const result = await caller.categories.create({
      name: "Subscriptions",
      icon: "Tag",
      color: "#8b5cf6",
      type: "expense",
    });
    expect(result).toHaveProperty("id");
  });

  it("deletes a custom category", async () => {
    const caller = createCaller();
    const result = await caller.categories.delete({ id: 100 });
    expect(result).toEqual({ success: true });
  });
});

describe("settings", () => {
  it("gets user settings", async () => {
    const caller = createCaller();
    const result = await caller.settings.get();
    expect(result).toHaveProperty("theme");
    expect(result).toHaveProperty("palette");
    expect(result).toHaveProperty("currency");
    expect(result!.theme).toBe("dark");
    expect(result!.palette).toBe("midnight-blue");
    expect(result!.currency).toBe("USD");
  });

  it("updates user settings", async () => {
    const caller = createCaller();
    const result = await caller.settings.update({
      theme: "light",
      palette: "emerald",
      currency: "EUR",
    });
    expect(result).toEqual({ success: true });
  });

  it("updates notification preferences", async () => {
    const caller = createCaller();
    const result = await caller.settings.update({
      notificationsEnabled: false,
      notifyOnLargeExpense: true,
      largeExpenseThreshold: "250.00",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("analytics", () => {
  it("returns daily balances", async () => {
    const caller = createCaller();
    const result = await caller.analytics.dailyBalances({
      startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endDate: Date.now(),
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty("day");
    expect(result[0]).toHaveProperty("income");
    expect(result[0]).toHaveProperty("expense");
  });

  it("returns monthly totals", async () => {
    const caller = createCaller();
    const result = await caller.analytics.monthlyTotals({ months: 6 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("month");
    expect(result[0]).toHaveProperty("income");
    expect(result[0]).toHaveProperty("expense");
  });

  it("returns category breakdown", async () => {
    const caller = createCaller();
    const result = await caller.analytics.categoryBreakdown({});
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("category");
    expect(result[0]).toHaveProperty("total");
    expect(result[0]).toHaveProperty("count");
  });
});

describe("receipt scanning", () => {
  it("uploads a receipt and returns signed URL", async () => {
    const caller = createCaller();
    const fakeBase64 = Buffer.from("fake-image-data").toString("base64");
    const result = await caller.receipt.upload({
      base64: fakeBase64,
      mimeType: "image/jpeg",
      fileName: "receipt.jpg",
    });
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("signedUrl");
    expect(typeof result.signedUrl).toBe("string");
  });

  it("scans a receipt image and extracts transaction data", async () => {
    const caller = createCaller();
    const result = await caller.receipt.scan({
      imageUrl: "https://signed-url.example.com/receipt.jpg",
    });
    expect(result).toHaveProperty("merchant");
    expect(result).toHaveProperty("amount");
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("category");
    expect(result.merchant).toBe("Walmart");
    expect(result.amount).toBe("42.50");
    expect(result.date).toBe("2026-04-25");
    expect(result.category).toBe("Shopping");
  });
});

describe("shared types", () => {
  it("has all required default categories", async () => {
    const { DEFAULT_CATEGORIES } = await import("../shared/appTypes");
    const names = DEFAULT_CATEGORIES.map(c => c.name);
    expect(names).toContain("Food");
    expect(names).toContain("Transport");
    expect(names).toContain("Shopping");
    expect(names).toContain("Bills");
    expect(names).toContain("Health");
    expect(names).toContain("Entertainment");
    expect(names).toContain("Income");
    expect(names).toContain("Other");
    DEFAULT_CATEGORIES.forEach(c => {
      expect(c).toHaveProperty("icon");
      expect(c).toHaveProperty("color");
      expect(c).toHaveProperty("type");
    });
  });

  it("has all required palette presets", async () => {
    const { PALETTES } = await import("../shared/appTypes");
    expect(PALETTES).toHaveProperty("midnight-blue");
    expect(PALETTES).toHaveProperty("emerald");
    expect(PALETTES).toHaveProperty("rose-gold");
    expect(PALETTES).toHaveProperty("slate");
    expect(PALETTES["midnight-blue"].label).toBe("Midnight Blue");
    expect(PALETTES["emerald"].label).toBe("Emerald");
    expect(PALETTES["rose-gold"].label).toBe("Rose Gold");
    expect(PALETTES["slate"].label).toBe("Slate");
    Object.values(PALETTES).forEach(p => {
      expect(p).toHaveProperty("primary");
      expect(p).toHaveProperty("primaryForeground");
      expect(p).toHaveProperty("chart1");
      expect(p).toHaveProperty("chart2");
      expect(p).toHaveProperty("chart3");
      expect(p).toHaveProperty("chart4");
      expect(p).toHaveProperty("chart5");
    });
  });

  it("has all required currencies", async () => {
    const { CURRENCIES } = await import("../shared/appTypes");
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(4);
    CURRENCIES.forEach(c => {
      expect(c).toHaveProperty("code");
      expect(c).toHaveProperty("symbol");
      expect(c).toHaveProperty("name");
    });
  });
});
