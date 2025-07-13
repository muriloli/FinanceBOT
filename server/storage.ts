import { users, categories, transactions, type User, type InsertUser, type Category, type InsertCategory, type Transaction, type InsertTransaction } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, gte, lte, sql, type SQL } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString);
const db = drizzle(client);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]>;
  getTransactionsByUserAndType(userId: string, type: 'income' | 'expense', startDate?: Date, endDate?: Date): Promise<Transaction[]>;
  getUserBalance(userId: string, startDate?: Date, endDate?: Date): Promise<{ income: number; expense: number; balance: number }>;
  getCategories(userId?: string): Promise<Category[]>;
  getCategoryByName(name: string, userId?: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.name, name)).limit(1);
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values([transaction]).returning();
    return result[0];
  }

  async getTransactionsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    let whereClause: SQL<unknown> = eq(transactions.userId, userId);
    
    if (startDate && endDate) {
      whereClause = and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate)
      )!;
    }
    
    return db.select().from(transactions).where(whereClause).orderBy(desc(transactions.transactionDate));
  }

  async getTransactionsByUserAndType(userId: string, type: 'income' | 'expense', startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    let whereClause: SQL<unknown> = and(eq(transactions.userId, userId), eq(transactions.type, type))!;
    
    if (startDate && endDate) {
      whereClause = and(
        eq(transactions.userId, userId),
        eq(transactions.type, type),
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate)
      )!;
    }
    
    return db.select().from(transactions).where(whereClause).orderBy(desc(transactions.transactionDate));
  }

  async getUserBalance(userId: string, startDate?: Date, endDate?: Date): Promise<{ income: number; expense: number; balance: number }> {
    let whereClause: SQL<unknown> = eq(transactions.userId, userId);
    
    if (startDate && endDate) {
      whereClause = and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate)
      )!;
    }
    
    const result = await db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(whereClause);
    
    const { income, expense } = result[0];
    return {
      income: Number(income),
      expense: Number(expense),
      balance: Number(income) - Number(expense)
    };
  }

  async getCategories(userId?: string): Promise<Category[]> {
    // Categories are shared across all users based on the actual database structure
    return db.select().from(categories);
  }

  async getCategoryByName(name: string, userId?: string): Promise<Category | undefined> {
    const whereClause: SQL<unknown> = eq(categories.name, name);
    
    const result = await db.select().from(categories).where(whereClause).limit(1);
    return result[0];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
