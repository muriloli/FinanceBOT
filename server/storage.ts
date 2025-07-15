import { users, categories, transactions, conversationHistory, conversationSummary, type User, type InsertUser, type Category, type InsertCategory, type Transaction, type InsertTransaction, type ConversationHistory, type InsertConversationHistory, type ConversationSummary, type InsertConversationSummary } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, gte, lte, sql, type SQL, like, or } from "drizzle-orm";

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
  getUserByPhoneContains(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]>;
  getTransactionsByUserAndType(userId: string, type: 'income' | 'expense', startDate?: Date, endDate?: Date, category?: string): Promise<Transaction[]>;
  getUserBalance(userId: string, startDate?: Date, endDate?: Date): Promise<{ income: number; expense: number; balance: number }>;
  getCategories(userId?: string): Promise<Category[]>;
  getCategoryByName(name: string, userId?: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Conversation History
  saveConversation(conversation: InsertConversationHistory): Promise<ConversationHistory>;
  getRecentConversations(userId: string, limit?: number): Promise<ConversationHistory[]>;
  getConversationSummary(userId: string): Promise<ConversationSummary | undefined>;
  updateConversationSummary(userId: string, summary: string, messageCount: number): Promise<ConversationSummary>;
  deleteOldConversations(userId: string, keepCount: number): Promise<void>;
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
    // Try exact match first
    let result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    
    if (result.length === 0) {
      // Try with LIKE pattern for partial matches
      result = await db.select().from(users).where(like(users.phone, `%${phone}%`)).limit(1);
    }
    
    return result[0];
  }

  async getUserByPhoneContains(phone: string): Promise<User | undefined> {
    // Search for phone numbers that contain the given digits
    const result = await db.select().from(users).where(like(users.phone, `%${phone}%`)).limit(1);
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

  async getTransactionsByUserAndType(userId: string, type: 'income' | 'expense', startDate?: Date, endDate?: Date, category?: string): Promise<Transaction[]> {
    console.log('📊 Storage debug - getTransactionsByUserAndType called');
    console.log('- userId:', userId);
    console.log('- type:', type);
    
    // First, let's test with a simple query to see if data exists
    const allUserTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
    console.log('📊 Total user transactions:', allUserTransactions.length);
    
    // Show sample data if exists
    if (allUserTransactions.length > 0) {
      console.log('📊 Sample transaction:', allUserTransactions[0]);
    }
    
    let conditions = [
      eq(transactions.userId, userId),
      eq(transactions.type, type)
    ];

    // Add date filtering using proper Drizzle ORM date handling
    if (startDate && endDate) {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log('📊 Date filtering:', startDateStr, 'to', endDateStr);
      
      // Use timestamp comparison for date filtering
      const startOfDay = new Date(startDateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(endDateStr + 'T23:59:59.999Z');
      
      console.log('📊 Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
      
      conditions.push(
        gte(transactions.transactionDate, startOfDay),
        lte(transactions.transactionDate, endOfDay)
      );
      
      console.log('📊 Total conditions:', conditions.length);
    }

    if (category) {
      const categoryRecord = await this.getCategoryByName(category, userId);
      if (categoryRecord) {
        conditions.push(eq(transactions.categoryId, categoryRecord.id));
      }
    }

    const result = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.transactionDate));
    console.log('📊 Query result:', result.length, 'transactions found');
    return result;
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

  // Conversation History Methods
  async saveConversation(conversation: InsertConversationHistory): Promise<ConversationHistory> {
    try {
      const result = await db.insert(conversationHistory).values(conversation).returning();
      return result[0];
    } catch (error) {
      console.error('Error saving conversation (table may not exist):', error);
      throw error;
    }
  }

  async getRecentConversations(userId: string, limit: number = 5): Promise<ConversationHistory[]> {
    try {
      return db.select()
        .from(conversationHistory)
        .where(eq(conversationHistory.userId, userId))
        .orderBy(desc(conversationHistory.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting recent conversations (table may not exist):', error);
      return [];
    }
  }

  async getConversationSummary(userId: string): Promise<ConversationSummary | undefined> {
    try {
      const result = await db.select()
        .from(conversationSummary)
        .where(eq(conversationSummary.userId, userId))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting conversation summary (table may not exist):', error);
      return undefined;
    }
  }

  async updateConversationSummary(userId: string, summary: string, messageCount: number): Promise<ConversationSummary> {
    try {
      // Try to update existing summary
      const existing = await this.getConversationSummary(userId);
      
      if (existing) {
        const result = await db.update(conversationSummary)
          .set({ 
            summary, 
            messageCount, 
            lastUpdated: new Date() 
          })
          .where(eq(conversationSummary.userId, userId))
          .returning();
        return result[0];
      } else {
        // Create new summary
        const result = await db.insert(conversationSummary)
          .values({
            userId,
            phone: '', // Will be updated when we have the phone
            summary,
            messageCount
          })
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error('Error updating conversation summary (table may not exist):', error);
      throw error;
    }
  }

  async deleteOldConversations(userId: string, keepCount: number): Promise<void> {
    try {
      // Get the IDs of conversations to keep (most recent ones)
      const conversationsToKeep = await db.select({ id: conversationHistory.id })
        .from(conversationHistory)
        .where(eq(conversationHistory.userId, userId))
        .orderBy(desc(conversationHistory.createdAt))
        .limit(keepCount);

      if (conversationsToKeep.length === 0) return;

      const idsToKeep = conversationsToKeep.map(c => c.id);
      
      // Delete conversations that are not in the keep list
      await db.delete(conversationHistory)
        .where(
          and(
            eq(conversationHistory.userId, userId),
            sql`${conversationHistory.id} NOT IN (${sql.join(idsToKeep.map(id => sql`${id}`), sql`, `)})`
          )
        );
    } catch (error) {
      console.error('Error deleting old conversations (table may not exist):', error);
      // Continue without failing if table doesn't exist
    }
  }
}

export const storage = new DatabaseStorage();
