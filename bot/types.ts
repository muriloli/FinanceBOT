export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  timestamp: number;
  type: 'text' | 'audio' | 'image' | 'video' | 'document';
  text?: {
    body: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
    size: number;
    voice?: boolean;
  };
  context?: {
    from: string;
    id: string;
  };
}

export interface WhatsAppWebhookPayload {
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: number;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface TransactionData {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date?: string;
}

export interface MultipleTransactionData {
  transactions: TransactionData[];
}

export interface FinancialQuery {
  period: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'year' | 'last_year' | 'custom';
  type: 'summary' | 'expenses' | 'income' | 'balance' | 'detailed';
  category?: string;
  startDate?: string;
  endDate?: string;
  comparison?: {
    period: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'year' | 'last_year' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  specificDay?: string;
}

export interface SmartFinancialQuery {
  period: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'year' | 'last_year' | 'custom';
  type: 'summary' | 'expenses' | 'income' | 'balance' | 'detailed';
  category?: string;
  startDate?: string;
  endDate?: string;
  comparison?: {
    period: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'year' | 'last_year' | 'custom';
    startDate?: string;
    endDate?: string;
    specificDay?: string;
  };
  specificDay?: string;
}

export interface BotResponse {
  message: string;
  success: boolean;
  data?: any;
}

export interface UserContext {
  userId: string;
  phone: string;
  username: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface FinancialData {
  transactions?: any[];
  total?: number;
  balance?: {
    income: number;
    expense: number;
    balance: number;
  };
  summary?: {
    income: number;
    expense: number;
    balance: number;
  };
  byCategory?: { [key: string]: { income: number; expense: number } };
  grouped?: { [key: string]: any[] };
  type: 'expense' | 'income' | 'balance' | 'summary' | 'detailed';
}

export interface ConversationContext {
  role: 'user' | 'assistant';
  content: string;
}

export interface BasicTransaction {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  date: string;
  category?: string;
}

export interface SmartQueryArgs {
  period: string;
  type: string;
  category?: string;
  comparison?: {
    period: string;
    startDate?: string;
    endDate?: string;
    specificDay?: string;
  };
  specificDay?: string;
  startDate?: string;
  endDate?: string;
}

export interface ComparisonData {
  mainData: FinancialData;
  comparisonData: FinancialData;
  difference: number;
  percentChange: number;
}

export interface CategoryMapping {
  [key: string]: string;
}

export interface PeriodLabels {
  [key: string]: string;
}

export interface QueryPattern {
  regex: RegExp;
  args: SmartFinancialQuery;
}

export interface TestQuery {
  name: string;
  message: string;
  expectedFunction: string;
  expectedArgs: any;
}

export interface ParsedQuery {
  period: string;
  type: string;
  category?: string;
  hasComparison?: boolean;
  specificDay?: string;
}

// Enum para tipos de período
export enum Period {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  WEEK = 'week',
  LAST_WEEK = 'last_week',
  MONTH = 'month',
  LAST_MONTH = 'last_month',
  YEAR = 'year',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom'
}

// Enum para tipos de consulta
export enum QueryType {
  SUMMARY = 'summary',
  EXPENSES = 'expenses',
  INCOME = 'income',
  BALANCE = 'balance',
  DETAILED = 'detailed'
}

// Enum para tipos de transação
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

// Interface para configuração de categorias padrão
export interface DefaultCategory {
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  keywords: string[];
}

// Interface para resposta de análise de período
export interface PeriodAnalysis {
  period: Period;
  startDate: Date;
  endDate: Date;
  label: string;
  isComparison?: boolean;
}

// Interface para dados de comparação formatados
export interface FormattedComparison {
  mainPeriod: string;
  comparisonPeriod: string;
  mainTotal: number;
  comparisonTotal: number;
  difference: number;
  percentChange: number;
  isIncrease: boolean;
  isDecrease: boolean;
  isEqual: boolean;
}

// Interface para resultado de consulta inteligente
export interface SmartQueryResult {
  success: boolean;
  message: string;
  data: {
    period: string;
    type: string;
    mainData: FinancialData;
    comparisonData?: FinancialData;
    hasComparison: boolean;
    formattedComparison?: FormattedComparison;
  };
}

// Interface para configuração de formatação de resposta
export interface ResponseFormatConfig {
  includeEmojis: boolean;
  includeUserName: boolean;
  includeTransactionCount: boolean;
  includeCategoryBreakdown: boolean;
  includePercentages: boolean;
  currency: string;
  locale: string;
}

// Interface para metadados de consulta
export interface QueryMetadata {
  timestamp: Date;
  userId: string;
  queryType: QueryType;
  period: Period;
  hasComparison: boolean;
  category?: string;
  executionTime?: number;
  resultCount?: number;
}

// Interface para cache de consultas
export interface QueryCache {
  key: string;
  data: FinancialData;
  timestamp: Date;
  expiresAt: Date;
  metadata: QueryMetadata;
}

// Interface para estatísticas de uso
export interface UsageStats {
  totalQueries: number;
  queryTypes: { [key in QueryType]: number };
  periods: { [key in Period]: number };
  categories: { [key: string]: number };
  comparisons: number;
  averageResponseTime: number;
}