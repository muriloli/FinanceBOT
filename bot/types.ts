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

export interface FinancialQuery {
  period: 'today' | 'week' | 'month' | 'year';
  type: 'summary' | 'expenses' | 'income' | 'balance';
}

export interface BotResponse {
  message: string;
  success: boolean;
  data?: any;
}

export interface UserContext {
  userId: number;
  phone: string;
  username: string;
}
