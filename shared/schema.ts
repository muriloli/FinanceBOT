import { pgTable, text, serial, integer, boolean, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cpf: text("cpf").notNull(),
  phone: text("phone"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
  admin: boolean("admin").default(false),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' or 'expense'
  color: text("color"),
  icon: text("icon"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  type: text("type").notNull(), // 'income' or 'expense'
  amount: decimal("amount").notNull(), // numeric without precision specification
  description: text("description").notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: false }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  source: text("source"),
});

export const conversationHistory = pgTable("conversation_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  phone: text("phone").notNull(),
  userMessage: text("user_message").notNull(),
  botResponse: text("bot_response").notNull(),
  messageType: text("message_type").notNull().default('chat'), // 'chat', 'transaction', 'query'
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

export const conversationSummary = pgTable("conversation_summary", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  phone: text("phone").notNull(),
  summary: text("summary").notNull(),
  messageCount: integer("message_count").default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: false }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isActive: true,
  admin: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationHistorySchema = createInsertSchema(conversationHistory).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSummarySchema = createInsertSchema(conversationSummary).omit({
  id: true,
  lastUpdated: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertConversationHistory = z.infer<typeof insertConversationHistorySchema>;
export type ConversationHistory = typeof conversationHistory.$inferSelect;
export type InsertConversationSummary = z.infer<typeof insertConversationSummarySchema>;
export type ConversationSummary = typeof conversationSummary.$inferSelect;
