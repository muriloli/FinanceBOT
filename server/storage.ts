import { users, categories, transactions, conversationHistory, conversationSummary, type User, type InsertUser, type Category, type InsertCategory, type Transaction, type InsertTransaction, type ConversationHistory, type InsertConversationHistory, type ConversationSummary, type InsertConversationSummary } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, gte, lte, sql, type SQL, like, or } from "drizzle-orm";

let db: any;
let isDbConnected = false;

try {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const client = postgres(connectionString);
    db = drizzle(client);
    isDbConnected = true;
    console.log("Database connected successfully");
  } else {
    console.warn("DATABASE_URL not set, using mock database for development");
    db = null;
    isDbConnected = false;
  }
} catch (error) {
  console.error("Database connection failed:", error);
  isDbConnected = false;
  db = null;
}

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

// Mock storage for development when database is not available
class MockStorage implements IStorage {
  private static instance: MockStorage;
  
  static getInstance(): MockStorage {
    if (!MockStorage.instance) {
      MockStorage.instance = new MockStorage();
      MockStorage.instance.initializeTestData();
    }
    return MockStorage.instance;
  }
  
  private mockUsers: User[] = [];
  private mockTransactions: Transaction[] = [];
  private mockCategories: Category[] = [];
  private mockConversations: ConversationHistory[] = [];
  private mockSummaries: ConversationSummary[] = [];

  private initializeTestData() {
    // Criar usuário de teste
    const testUser: User = {
      id: "b3bda624-4769-4667-a24d-cfc02d3aef0e",
      name: "Murilo Lima",
      cpf: "12345678901",
      phone: "556696716332",
      password: "password123",
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      admin: false,
    };
    this.mockUsers.push(testUser);

    // Criar algumas categorias de teste
    const testCategories: Category[] = [
      {
        id: "cat-1",
        name: "Alimentação",
        type: "expense",
        color: "#FF6B6B",
        icon: "🍔",
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: "cat-2", 
        name: "Transporte",
        type: "expense",
        color: "#4ECDC4",
        icon: "🚗",
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: "cat-3",
        name: "Salário",
        type: "income",
        color: "#45B7D1",
        icon: "💰",
        isDefault: true,
        createdAt: new Date(),
      }
    ];
    this.mockCategories.push(...testCategories);

    // Criar algumas transações de teste para hoje
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const testTransactions: Transaction[] = [
      {
        id: "trans-1",
        userId: testUser.id,
        categoryId: "cat-1",
        type: "expense",
        amount: "25.50",
        description: "Almoço no restaurante",
        transactionDate: today,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "whatsapp-bot",
      },
      {
        id: "trans-2",
        userId: testUser.id,
        categoryId: "cat-2",
        type: "expense", 
        amount: "15.00",
        description: "Uber para o trabalho",
        transactionDate: today,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "whatsapp-bot",
      },
      {
        id: "trans-3",
        userId: testUser.id,
        categoryId: "cat-1",
        type: "expense",
        amount: "8.50",
        description: "Café da manhã",
        transactionDate: yesterday,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "whatsapp-bot",
      }
    ];
    this.mockTransactions.push(...testTransactions);

    console.log("🎯 Mock data initialized with user:", testUser.name, "and", testTransactions.length, "transactions");
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.mockUsers.find(u => u.id === id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    return this.mockUsers.find(u => u.name === name);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return this.mockUsers.find(u => u.phone === phone);
  }

  async getUserByPhoneContains(phone: string): Promise<User | undefined> {
    return this.mockUsers.find(u => u.phone?.includes(phone));
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: Math.random().toString(),
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      admin: false,
    };
    this.mockUsers.push(newUser);
    return newUser;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const newTransaction: Transaction = {
      id: Math.random().toString(),
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.mockTransactions.push(newTransaction);
    return newTransaction;
  }

  async getTransactionsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    let filtered = this.mockTransactions.filter(t => t.userId === userId);
    
    if (startDate && endDate) {
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.transactionDate);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }
    
    return filtered.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  async getTransactionsByUserAndType(userId: string, type: 'income' | 'expense', startDate?: Date, endDate?: Date, category?: string): Promise<Transaction[]> {
    let filtered = this.mockTransactions.filter(t => t.userId === userId && t.type === type);
    
    if (startDate && endDate) {
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.transactionDate);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }
    
    if (category) {
      filtered = filtered.filter(t => {
        // Implementar lógica de categoria quando necessário
        return true;
      });
    }
    
    return filtered.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  async getUserBalance(userId: string, startDate?: Date, endDate?: Date): Promise<{ income: number; expense: number; balance: number }> {
    const userTransactions = this.mockTransactions.filter(t => t.userId === userId);
    const income = userTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = userTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return { income, expense, balance: income - expense };
  }

  async getCategories(userId?: string): Promise<Category[]> {
    return this.mockCategories;
  }

  async getCategoryByName(name: string, userId?: string): Promise<Category | undefined> {
    return this.mockCategories.find(c => c.name === name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const newCategory: Category = {
      id: Math.random().toString(),
      ...category,
      createdAt: new Date(),
    };
    this.mockCategories.push(newCategory);
    return newCategory;
  }

  async saveConversation(conversation: InsertConversationHistory): Promise<ConversationHistory> {
    const newConversation: ConversationHistory = {
      id: Math.random().toString(),
      ...conversation,
      createdAt: new Date(),
    };
    this.mockConversations.push(newConversation);
    return newConversation;
  }

  async getRecentConversations(userId: string, limit: number = 5): Promise<ConversationHistory[]> {
    return this.mockConversations.filter(c => c.userId === userId).slice(-limit);
  }

  async getConversationSummary(userId: string): Promise<ConversationSummary | undefined> {
    return this.mockSummaries.find(s => s.userId === userId);
  }

  async updateConversationSummary(userId: string, summary: string, messageCount: number): Promise<ConversationSummary> {
    const existing = this.mockSummaries.find(s => s.userId === userId);
    if (existing) {
      existing.summary = summary;
      existing.messageCount = messageCount;
      existing.lastUpdated = new Date();
      return existing;
    }
    const newSummary: ConversationSummary = {
      id: Math.random().toString(),
      userId,
      phone: '',
      summary,
      messageCount,
      lastUpdated: new Date(),
    };
    this.mockSummaries.push(newSummary);
    return newSummary;
  }

  async deleteOldConversations(userId: string, keepCount: number): Promise<void> {
    const userConversations = this.mockConversations.filter(c => c.userId === userId);
    if (userConversations.length > keepCount) {
      userConversations.slice(0, -keepCount).forEach(conv => {
        const index = this.mockConversations.indexOf(conv);
        if (index > -1) this.mockConversations.splice(index, 1);
      });
    }
  }
}

export class DatabaseStorage implements IStorage {
  private mockStorage = MockStorage.getInstance();

  async getUser(id: string): Promise<User | undefined> {
    if (!isDbConnected) return this.mockStorage.getUser(id);
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByName(name: string): Promise<User | undefined> {
    if (!isDbConnected) return this.mockStorage.getUserByName(name);
    const result = await db.select().from(users).where(eq(users.name, name)).limit(1);
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    if (!isDbConnected) return this.mockStorage.getUserByPhone(phone);
    // Try exact match first
    let result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    
    if (result.length === 0) {
      // Try with LIKE pattern for partial matches
      result = await db.select().from(users).where(like(users.phone, `%${phone}%`)).limit(1);
    }
    
    return result[0];
  }

  async getUserByPhoneContains(phone: string): Promise<User | undefined> {
    if (!isDbConnected) return this.mockStorage.getUserByPhoneContains(phone);
    // Search for phone numbers that contain the given digits
    const result = await db.select().from(users).where(like(users.phone, `%${phone}%`)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!isDbConnected) return this.mockStorage.createUser(insertUser);
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    if (!isDbConnected) return this.mockStorage.createTransaction(transaction);
    const result = await db.insert(transactions).values([transaction]).returning();
    return result[0];
  }

  async getTransactionsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!isDbConnected) return this.mockStorage.getTransactionsByUser(userId, startDate, endDate);
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
    if (!isDbConnected) return this.mockStorage.getTransactionsByUserAndType(userId, type, startDate, endDate, category);
    let conditions = [
      eq(transactions.userId, userId),
      eq(transactions.type, type)
    ];

    // Add date filtering using proper Drizzle ORM date handling
    if (startDate && endDate) {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Use timestamp comparison for date filtering
      const startOfDay = new Date(startDateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(endDateStr + 'T23:59:59.999Z');
      
      conditions.push(
        gte(transactions.transactionDate, startOfDay),
        lte(transactions.transactionDate, endOfDay)
      );
    }

    if (category) {
      const categoryRecord = await this.getCategoryByName(category, userId);
      if (categoryRecord) {
        conditions.push(eq(transactions.categoryId, categoryRecord.id));
      }
    }

    const result = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.transactionDate));
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
