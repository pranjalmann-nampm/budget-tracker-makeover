import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  description: text("description"),
  merchant: varchar("merchant", { length: 255 }),
  date: bigint("date", { mode: "number" }).notNull(), // UTC ms timestamp
  receiptUrl: text("receiptUrl"),
  receiptKey: varchar("receiptKey", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // null = system default
  name: varchar("name", { length: 64 }).notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  color: varchar("color", { length: 32 }).notNull(),
  type: mysqlEnum("type", ["income", "expense", "both"]).default("expense").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  theme: mysqlEnum("theme", ["dark", "light"]).default("dark").notNull(),
  palette: varchar("palette", { length: 32 }).default("midnight-blue").notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  notifyOnLargeExpense: boolean("notifyOnLargeExpense").default(true).notNull(),
  largeExpenseThreshold: decimal("largeExpenseThreshold", { precision: 12, scale: 2 }).default("100.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
