import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut, storageGetSignedUrl } from "./storage";
import { DEFAULT_CATEGORIES } from "../shared/appTypes";

// Ensure default categories exist on server start
db.ensureDefaultCategories().catch(e => console.error("[DB] Failed to seed categories:", e));

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  transactions: router({
    list: protectedProcedure.input(z.object({
      type: z.enum(["income", "expense"]).optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional()).query(async ({ ctx, input }) => {
      return db.getTransactions(ctx.user.id, input ?? {});
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      return db.getTransactionById(input.id, ctx.user.id);
    }),

    create: protectedProcedure.input(z.object({
      type: z.enum(["income", "expense"]),
      amount: z.string(),
      category: z.string(),
      description: z.string().optional(),
      merchant: z.string().optional(),
      date: z.number(),
      receiptUrl: z.string().optional(),
      receiptKey: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createTransaction({
        userId: ctx.user.id,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        merchant: input.merchant ?? null,
        date: input.date,
        receiptUrl: input.receiptUrl ?? null,
        receiptKey: input.receiptKey ?? null,
      });
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      type: z.enum(["income", "expense"]).optional(),
      amount: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      merchant: z.string().optional(),
      date: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateTransaction(id, ctx.user.id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteTransaction(input.id, ctx.user.id);
      return { success: true };
    }),

    exportAll: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllTransactionsForExport(ctx.user.id);
    }),

    bulkImport: protectedProcedure.input(z.object({
      items: z.array(z.object({
        type: z.enum(["income", "expense"]),
        amount: z.string(),
        category: z.string(),
        description: z.string().optional(),
        merchant: z.string().optional(),
        date: z.number(),
      })),
    })).mutation(async ({ ctx, input }) => {
      const count = await db.bulkImportTransactions(ctx.user.id, input.items.map(i => ({
        type: i.type,
        amount: i.amount,
        category: i.category,
        description: i.description ?? null,
        merchant: i.merchant ?? null,
        date: i.date,
        receiptUrl: null,
        receiptKey: null,
      })));
      return { imported: count };
    }),
  }),

  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getCategories(ctx.user.id);
    }),

    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(64),
      icon: z.string().min(1).max(64),
      color: z.string().min(1).max(32),
      type: z.enum(["income", "expense", "both"]),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createCategory({
        userId: ctx.user.id,
        name: input.name,
        icon: input.icon,
        color: input.color,
        type: input.type,
        isDefault: false,
      });
      return { id };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteCategory(input.id, ctx.user.id);
      return { success: true };
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserSettings(ctx.user.id);
    }),

    update: protectedProcedure.input(z.object({
      theme: z.enum(["dark", "light"]).optional(),
      palette: z.string().optional(),
      currency: z.string().optional(),
      notificationsEnabled: z.boolean().optional(),
      notifyOnLargeExpense: z.boolean().optional(),
      largeExpenseThreshold: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateUserSettings(ctx.user.id, input);
      return { success: true };
    }),
  }),

  analytics: router({
    dailyBalances: protectedProcedure.input(z.object({
      startDate: z.number(),
      endDate: z.number(),
    })).query(async ({ ctx, input }) => {
      return db.getDailyBalances(ctx.user.id, input.startDate, input.endDate);
    }),

    monthlyTotals: protectedProcedure.input(z.object({
      months: z.number().min(1).max(24).optional(),
    }).optional()).query(async ({ ctx, input }) => {
      return db.getMonthlyTotals(ctx.user.id, input?.months ?? 6);
    }),

    categoryBreakdown: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      return db.getCategoryBreakdown(ctx.user.id, input?.startDate, input?.endDate);
    }),
  }),

  receipt: router({
    upload: protectedProcedure.input(z.object({
      base64: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
    })).mutation(async ({ ctx, input }) => {
      // Upload receipt image to S3
      const buffer = Buffer.from(input.base64, "base64");
      const key = `receipts/${ctx.user.id}/${Date.now()}-${input.fileName}`;
      const { url, key: storedKey } = await storagePut(key, buffer, input.mimeType);

      // Get signed URL for LLM vision
      const signedUrl = await storageGetSignedUrl(storedKey);

      return { url, key: storedKey, signedUrl };
    }),

    scan: protectedProcedure.input(z.object({
      imageUrl: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const categoryNames = DEFAULT_CATEGORIES.map(c => c.name).join(", ");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a receipt/invoice data extraction assistant. Extract the following fields from the receipt image:
- merchant: The store or business name
- amount: The total amount as a number string (e.g., "42.50")
- date: The date in ISO format (YYYY-MM-DD). If unclear, use today's date.
- category: Best matching category from: ${categoryNames}

Return ONLY valid JSON with these 4 fields. No explanation.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the transaction details from this receipt image." },
              { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                merchant: { type: "string", description: "Store or business name" },
                amount: { type: "string", description: "Total amount as number string" },
                date: { type: "string", description: "Date in YYYY-MM-DD format" },
                category: { type: "string", description: "Best matching category" },
              },
              required: ["merchant", "amount", "date", "category"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("Failed to extract receipt data");
      }

      const parsed = JSON.parse(content);
      return {
        merchant: parsed.merchant || "",
        amount: parsed.amount || "0",
        date: parsed.date || new Date().toISOString().split("T")[0],
        category: parsed.category || "Other",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
