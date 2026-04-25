import { eq, and, desc, asc, sql, between, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, transactions, categories, userSettings } from "../drizzle/schema";
import type { InsertTransaction, InsertCategory, InsertUserSettings } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DEFAULT_CATEGORIES } from "../shared/appTypes";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ TRANSACTIONS ============

export async function getTransactions(userId: number, opts?: {
  type?: "income" | "expense";
  category?: string;
  search?: string;
  startDate?: number;
  endDate?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [eq(transactions.userId, userId)];
  if (opts?.type) conditions.push(eq(transactions.type, opts.type));
  if (opts?.category) conditions.push(eq(transactions.category, opts.category));
  if (opts?.startDate && opts?.endDate) {
    conditions.push(between(transactions.date, opts.startDate, opts.endDate));
  } else if (opts?.startDate) {
    conditions.push(sql`${transactions.date} >= ${opts.startDate}`);
  } else if (opts?.endDate) {
    conditions.push(sql`${transactions.date} <= ${opts.endDate}`);
  }
  if (opts?.search) {
    const q = `%${opts.search}%`;
    conditions.push(or(
      like(transactions.description, q),
      like(transactions.merchant, q),
      like(transactions.category, q)
    )!);
  }

  const where = and(...conditions);

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(transactions).where(where);
  const total = Number(countResult?.count ?? 0);

  const sortCol = opts?.sortBy === "amount" ? transactions.amount
    : opts?.sortBy === "category" ? transactions.category
    : transactions.date;
  const sortFn = opts?.sortDir === "asc" ? asc : desc;

  const items = await db.select().from(transactions).where(where)
    .orderBy(sortFn(sortCol))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);

  return { items, total };
}

export async function getTransactionById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createTransaction(data: Omit<InsertTransaction, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(transactions).values(data).$returningId();
  return result.id;
}

export async function updateTransaction(id: number, userId: number, data: Partial<Omit<InsertTransaction, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function getAllTransactionsForExport(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date));
}

export async function bulkImportTransactions(userId: number, items: Omit<InsertTransaction, "id" | "userId" | "createdAt" | "updatedAt">[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return 0;
  const values = items.map(item => ({ ...item, userId }));
  await db.insert(transactions).values(values);
  return items.length;
}

// ============ CATEGORIES ============

export async function getCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories)
    .where(or(eq(categories.userId, userId), sql`${categories.userId} IS NULL`))
    .orderBy(asc(categories.name));
}

export async function ensureDefaultCategories() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(categories).where(sql`${categories.userId} IS NULL`);
  if (existing.length > 0) return;
  const defaults = DEFAULT_CATEGORIES.map(c => ({
    userId: null as unknown as number,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: c.type === "income" ? "income" as const : c.type === "both" ? "both" as const : "expense" as const,
    isDefault: true,
  }));
  await db.insert(categories).values(defaults);
}

export async function createCategory(data: Omit<InsertCategory, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(categories).values(data).$returningId();
  return result.id;
}

export async function deleteCategory(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

// ============ USER SETTINGS ============

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (result.length === 0) {
    await db.insert(userSettings).values({ userId });
    const newResult = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    return newResult[0] ?? null;
  }
  return result[0];
}

export async function updateUserSettings(userId: number, data: Partial<Omit<InsertUserSettings, "id" | "userId" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(userSettings).values({ userId, ...data });
  } else {
    await db.update(userSettings).set(data).where(eq(userSettings.userId, userId));
  }
}

// ============ ANALYTICS ============

export async function getDailyBalances(userId: number, startDate: number, endDate: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    day: sql<string>`DATE(FROM_UNIXTIME(${transactions.date} / 1000))`.as("day"),
    income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`.as("income"),
    expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`.as("expense"),
  }).from(transactions)
    .where(and(eq(transactions.userId, userId), between(transactions.date, startDate, endDate)))
    .groupBy(sql`day`)
    .orderBy(sql`day`);
  return rows;
}

export async function getMonthlyTotals(userId: number, months: number = 6) {
  const db = await getDb();
  if (!db) return [];
  const startDate = Date.now() - months * 30 * 24 * 60 * 60 * 1000;
  const rows = await db.select({
    month: sql<string>`DATE_FORMAT(FROM_UNIXTIME(${transactions.date} / 1000), '%Y-%m')`.as("month"),
    income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`.as("income"),
    expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`.as("expense"),
  }).from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.date} >= ${startDate}`))
    .groupBy(sql`month`)
    .orderBy(sql`month`);
  return rows;
}

export async function getCategoryBreakdown(userId: number, startDate?: number, endDate?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId), eq(transactions.type, "expense")];
  if (startDate && endDate) conditions.push(between(transactions.date, startDate, endDate));
  const rows = await db.select({
    category: transactions.category,
    total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`.as("total"),
    count: sql<number>`COUNT(*)`.as("count"),
  }).from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.category)
    .orderBy(sql`total DESC`);
  return rows;
}
