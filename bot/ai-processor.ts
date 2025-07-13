import OpenAI from 'openai';
import { TransactionData, FinancialQuery, BotResponse, UserContext } from './types';
import { storage } from '../server/storage';

export class AIProcessor {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not configured. AI processing will be disabled.');
      // Initialize with a dummy key to prevent constructor errors
      this.openai = new OpenAI({ apiKey: 'dummy-key' });
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async processMessage(message: string, userContext: UserContext): Promise<BotResponse> {
    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        return {
          message: "⚠️ Bot não configurado. OpenAI API key necessária para processar mensagens.",
          success: false,
        };
      }

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(),
          },
          {
            role: "user",
            content: message,
          },
        ],
        functions: this.getFunctionDefinitions(),
        function_call: "auto",
        temperature: 0.3,
      });

      const responseMessage = response.choices[0].message;

      if (responseMessage.function_call) {
        return await this.handleFunctionCall(
          responseMessage.function_call.name,
          responseMessage.function_call.arguments,
          userContext
        );
      }

      return {
        message: responseMessage.content || "Desculpe, não consegui processar sua mensagem.",
        success: true,
      };
    } catch (error) {
      console.error('Error processing message with AI:', error);
      return {
        message: "😔 Ocorreu um erro ao processar sua mensagem. Tente novamente.",
        success: false,
      };
    }
  }

  private getSystemPrompt(): string {
    const today = new Date();
    const currentDate = today.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return `Você é um assistente financeiro para o aplicativo FinanceFlow.

DATA ATUAL: ${currentDate} (13/07/2025)

REGRAS:
1. Responda APENAS a tópicos relacionados a finanças
2. Para perguntas não relacionadas a finanças, responda: "Posso ajudar apenas com questões financeiras"
3. Sempre use function calling para registrar transações
4. Seja amigável mas conciso
5. Use português brasileiro
6. Use emojis para deixar as respostas mais amigáveis

CAPACIDADES:
- Registrar despesas e receitas
- Consultar resumos financeiros
- Fornecer insights de gastos
- Responder perguntas sobre finanças

CATEGORIAS PADRÃO:
- Alimentação
- Transporte
- Saúde
- Educação
- Lazer
- Moradia
- Roupas
- Salário
- Freelance
- Investimentos

PROCESSAMENTO DE DATAS:
HOJE É 13/07/2025 (sábado). Use esta data como referência para todos os cálculos.

Quando o usuário mencionar uma data específica, extraia e converta para formato ISO:
- "ontem" = 12/07/2025 (sexta-feira)
- "anteontem" = 11/07/2025 (quinta-feira)
- "segunda passada", "terça passada", etc = último dia da semana mencionado
- "dia 14", "dia 25" = dia específico do mês atual (julho 2025)
- "dia 14 do mês passado" = dia específico do mês anterior (junho 2025)
- "segunda-feira", "terça-feira" = próximo ou último dia da semana
- Se não mencionar data, use 13/07/2025

IMPORTANTE: Sempre passe a data no campo 'date' como string no formato 'YYYY-MM-DD'.

Quando o usuário mencionar uma transação, extraia as informações e use a função register_transaction.
Para consultas sobre finanças, use a função query_finances.`;
  }

  private getFunctionDefinitions() {
    return [
      {
        name: "register_transaction",
        description: "Registrar uma transação de despesa ou receita",
        parameters: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Valor da transação",
            },
            type: {
              type: "string",
              enum: ["income", "expense"],
              description: "Tipo da transação",
            },
            category: {
              type: "string",
              description: "Categoria da transação",
            },
            description: {
              type: "string",
              description: "Descrição da transação",
            },
            date: {
              type: "string",
              format: "date",
              description: "Data da transação no formato YYYY-MM-DD. Interprete expressões como 'ontem', 'terça passada', 'dia 14', etc. Se não especificado, use hoje.",
            },
          },
          required: ["amount", "type", "category", "description"],
        },
      },
      {
        name: "query_finances",
        description: "Consultar informações financeiras do usuário",
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "week", "month", "year"],
              description: "Período da consulta",
            },
            type: {
              type: "string",
              enum: ["summary", "expenses", "income", "balance"],
              description: "Tipo de consulta",
            },
          },
          required: ["period", "type"],
        },
      },
    ];
  }

  private async handleFunctionCall(
    functionName: string,
    argumentsJson: string,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const args = JSON.parse(argumentsJson);

      if (functionName === "register_transaction") {
        return await this.registerTransaction(args, userContext);
      }

      if (functionName === "query_finances") {
        return await this.queryFinances(args, userContext);
      }

      return {
        message: "Função não reconhecida.",
        success: false,
      };
    } catch (error) {
      console.error('Error handling function call:', error);
      return {
        message: "😔 Ocorreu um erro ao processar sua solicitação.",
        success: false,
      };
    }
  }

  private async registerTransaction(
    data: TransactionData,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Find or create category
      let category = await storage.getCategoryByName(data.category, userContext.userId);
      if (!category) {
        category = await storage.createCategory({
          name: data.category,
          type: data.type,
          color: '#6B7280',
          icon: 'category',
          isDefault: false,
        });
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        userId: userContext.userId,
        amount: data.amount.toString(),
        type: data.type,
        categoryId: category.id,
        description: data.description,
        transactionDate: data.date ? new Date(data.date) : new Date(),
        source: 'whatsapp',
      });

      const typeEmoji = data.type === 'income' ? '💰' : '💸';
      const transactionDate = data.date ? new Date(data.date) : new Date();
      const dateStr = this.formatDateForMessage(transactionDate);
      
      const message = `✅ ${data.type === 'income' ? 'Receita' : 'Despesa'} registrada!
${typeEmoji} R$ ${data.amount.toFixed(2).replace('.', ',')} - ${data.category}
📝 ${data.description}
📅 ${dateStr}`;

      return {
        message,
        success: true,
        data: transaction,
      };
    } catch (error) {
      console.error('Error registering transaction:', error);
      return {
        message: "😔 Erro ao registrar a transação. Tente novamente.",
        success: false,
      };
    }
  }

  private async queryFinances(
    query: FinancialQuery,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const { startDate, endDate } = this.getPeriodDates(query.period);
      
      if (query.type === 'summary' || query.type === 'balance') {
        const balance = await storage.getUserBalance(userContext.userId, startDate, endDate);
        
        const periodText = this.getPeriodText(query.period);
        const message = `📊 Resumo Financeiro - ${periodText}
💰 Receitas: R$ ${balance.income.toFixed(2).replace('.', ',')}
💸 Despesas: R$ ${balance.expense.toFixed(2).replace('.', ',')}
${balance.balance >= 0 ? '💚' : '❤️'} Saldo: R$ ${balance.balance.toFixed(2).replace('.', ',')}`;

        return {
          message,
          success: true,
          data: balance,
        };
      }

      if (query.type === 'expenses' || query.type === 'income') {
        const transactions = await storage.getTransactionsByUserAndType(
          userContext.userId,
          query.type as 'income' | 'expense',
          startDate,
          endDate
        );

        const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const typeEmoji = query.type === 'income' ? '💰' : '💸';
        const typeText = query.type === 'income' ? 'Receitas' : 'Despesas';
        const periodText = this.getPeriodText(query.period);

        let message = `${typeEmoji} ${typeText} - ${periodText}
Total: R$ ${total.toFixed(2).replace('.', ',')}`;

        if (transactions.length > 0) {
          message += '\n\n📋 Últimas transações:';
          transactions.slice(0, 5).forEach(t => {
            message += `\n• R$ ${Number(t.amount).toFixed(2).replace('.', ',')} - ${t.description}`;
          });
        }

        return {
          message,
          success: true,
          data: { transactions, total },
        };
      }

      return {
        message: "Tipo de consulta não reconhecido.",
        success: false,
      };
    } catch (error) {
      console.error('Error querying finances:', error);
      return {
        message: "😔 Erro ao consultar suas finanças. Tente novamente.",
        success: false,
      };
    }
  }

  private getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  private getPeriodText(period: string): string {
    const now = new Date();
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    switch (period) {
      case 'today':
        return 'Hoje';
      case 'week':
        return 'Últimos 7 dias';
      case 'month':
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
      case 'year':
        return `${now.getFullYear()}`;
      default:
        return period;
    }
  }

  private formatDateForMessage(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return 'Hoje';
    } else if (isYesterday) {
      return 'Ontem';
    } else {
      // Formatação brasileira: dd/mm/aaaa
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      // Adicionar dia da semana em português
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const weekday = weekdays[date.getDay()];
      
      return `${weekday}, ${day}/${month}/${year}`;
    }
  }
}
