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
        // Handle basic greetings and simple interactions without AI
        return await this.handleBasicMessage(message, userContext);
      }

      // Get conversation history and summary
      const conversationContext = await this.buildConversationContext(userContext.userId);
      
      const systemPrompt = this.getSystemPrompt() + `\n\nCONTEXTO DO USUÁRIO:
- Nome: ${userContext.username}
- Telefone: ${userContext.phone}
- ID: ${userContext.userId}

IMPORTANTE: Sempre chame o usuário pelo nome (${userContext.username}) nas suas respostas para personalizar a experiência.`;

      const messages = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        ...conversationContext,
        {
          role: "user" as const,
          content: message,
        },
      ];

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        functions: this.getFunctionDefinitions(),
        function_call: "auto",
        temperature: 0.3,
      });

      const responseMessage = response.choices[0].message;
      let botResponse: BotResponse;

      if (responseMessage.function_call) {
        botResponse = await this.handleFunctionCall(
          responseMessage.function_call.name,
          responseMessage.function_call.arguments,
          userContext
        );
      } else {
        botResponse = {
          message: responseMessage.content || "Desculpe, não consegui processar sua mensagem.",
          success: true,
        };
      }

      // Save conversation to history
      await this.saveConversationToHistory(message, botResponse.message, userContext);

      return botResponse;
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
    
    return `Você é um assistente financeiro inteligente para o aplicativo FinanceFlow.

DATA ATUAL: ${currentDate}

🎯 MISSÃO: Dar total liberdade ao usuário para fazer QUALQUER pergunta sobre suas finanças e responder de forma inteligente e natural.

REGRAS FUNDAMENTAIS:
1. Seja extremamente inteligente na interpretação de datas e períodos
2. Permita perguntas livres e naturais sobre finanças  
3. Use smart_financial_query para TODAS as consultas financeiras
4. Interprete datas de forma contextual e inteligente
5. Seja amigável mas mantenha foco nas finanças
6. Faça perguntas esclarecedoras se algo não estiver claro
7. Use dados reais do banco para responder
8. Sempre chame o usuário pelo nome quando disponível
9. NUNCA mencione SQL, banco de dados, tabelas ou código
10. NUNCA dê instruções técnicas ou de programação
11. Você é um ASSISTENTE FINANCEIRO, não um programador

INTERPRETAÇÃO INTELIGENTE DE DATAS:
- "hoje" = ${today.toISOString().split('T')[0]}
- "ontem" = ${new Date(today.getTime() - 24*60*60*1000).toISOString().split('T')[0]}
- "anteontem" = dois dias atrás
- "segunda passada", "terça passada" = último dia da semana mencionado
- "semana passada" = segunda a domingo da semana anterior
- "esta semana" = segunda a domingo atual  
- "mês passado" = mês anterior completo
- "este mês" = do dia 1 até hoje

EXEMPLOS DE INTERPRETAÇÃO LIVRE:
- "quanto gastei hoje?" → smart_financial_query(period="today", type="expenses")
- "gostaria de saber quanto gastei ontem" → smart_financial_query(period="yesterday", type="expenses")  
- "quanto gastei semana passada?" → smart_financial_query(period="last_week", type="expenses")
- "quanto já gastei essa semana?" → smart_financial_query(period="week", type="expenses")
- "compare quanto gastei terça passada" → smart_financial_query(period="custom", specificDay="2025-07-09", comparison={period:"today"})
- "quanto gastei semana passada com alimentação?" → smart_financial_query(period="last_week", type="expenses", category="Alimentação")
- "compare semana passada com essa semana" → smart_financial_query(period="last_week", type="expenses", comparison={period:"week"})
- "resumo do mês até agora" → smart_financial_query(period="month", type="summary")
- "como estão minhas finanças?" → smart_financial_query(period="month", type="summary")

IMPORTANTES DIRETRIZES:
- Use SEMPRE smart_financial_query para consultas financeiras
- Seja criativo e flexível na interpretação
- Mantenha conversas naturais e amigáveis
- Para não-finanças: "Posso ajudar principalmente com questões financeiras"

CAPACIDADES:
- Registrar despesas e receitas
- Consultar resumos financeiros flexíveis
- Fornecer insights de gastos
- Comparações entre períodos
- Responder perguntas sobre finanças
- Conversar de forma amigável sobre tópicos relacionados

CATEGORIAS PADRÃO:
- Alimentação, Transporte, Saúde, Educação, Lazer, Moradia, Roupas, Salário, Freelance, Investimentos, Outros`;
  }

  private getFunctionDefinitions() {
    return [
      {
        name: "register_transaction",
        description: "Registrar uma transação financeira (receita ou despesa)",
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
              description: "Data da transação no formato YYYY-MM-DD. IMPORTANTE: Se o usuário disser 'hoje', use SEMPRE a data atual. Para 'ontem', use dia anterior. Se não especificado, use a data atual.",
            },
          },
          required: ["amount", "type", "category", "description"],
        },
      },
      {
        name: "register_multiple_transactions",
        description: "Registrar múltiplas transações de uma vez quando o usuário mencionar várias despesas ou receitas na mesma mensagem",
        parameters: {
          type: "object",
          properties: {
            transactions: {
              type: "array",
              items: {
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
                    description: "Data da transação no formato YYYY-MM-DD",
                  },
                },
                required: ["amount", "type", "category", "description"],
              },
              description: "Lista de transações para registrar",
            },
          },
          required: ["transactions"],
        },
      },
      {
        name: "smart_financial_query",
        description: `Consulta inteligente e flexível de dados financeiros. Interpreta perguntas naturais do usuário sobre finanças e busca informações específicas no banco de dados.
        
        EXEMPLOS PRÁTICOS:
        - "quanto gastei hoje?" → period="today", type="expenses"
        - "quanto gastei ontem?" → period="yesterday", type="expenses"  
        - "quanto gastei semana passada?" → period="last_week", type="expenses"
        - "quanto ja gastei essa semana?" → period="week", type="expenses"
        - "compare quanto gastei terça passada com hoje" → period="custom", specificDay="2025-07-09", comparison={period:"today"}
        - "quanto gastei semana passada com alimentação?" → period="last_week", type="expenses", category="Alimentação"
        - "quanto gastei semana passada vs essa semana?" → period="last_week", type="expenses", comparison={period:"week"}
        - "resumo do mes até agora" → period="month", type="summary"
        - "como estão minhas finanças?" → period="month", type="summary"
        - "meu saldo atual" → period="month", type="balance"
        - "quanto recebi este mês?" → period="month", type="income"`,
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "yesterday", "week", "last_week", "month", "last_month", "year", "last_year", "custom"],
              description: "Período da consulta. Use 'custom' para datas específicas como 'terça passada', 'dia 10', etc."
            },
            type: {
              type: "string", 
              enum: ["summary", "expenses", "income", "balance", "detailed"],
              description: "Tipo de informação: summary=resumo geral, expenses=gastos, income=receitas, balance=saldo, detailed=detalhado"
            },
            category: {
              type: "string",
              description: "Categoria específica para filtrar (Alimentação, Transporte, Saúde, Lazer, etc.)"
            },
            startDate: {
              type: "string",
              format: "date", 
              description: "Data inicial para período custom (YYYY-MM-DD)"
            },
            endDate: {
              type: "string",
              format: "date",
              description: "Data final para período custom (YYYY-MM-DD)"
            },
            comparison: {
              type: "object",
              properties: {
                period: {
                  type: "string",
                  enum: ["today", "yesterday", "week", "last_week", "month", "last_month", "year", "last_year", "custom"],
                  description: "Período para comparar"
                },
                startDate: {
                  type: "string", 
                  format: "date",
                  description: "Data inicial da comparação"
                },
                endDate: {
                  type: "string",
                  format: "date", 
                  description: "Data final da comparação"
                }
              },
              description: "Para comparações entre períodos (ex: 'compare esta semana com semana passada')"
            },
            specificDay: {
              type: "string",
              format: "date",
              description: "Data específica quando usuário menciona um dia exato (ex: 'terça passada' = '2025-07-09')"
            }
          },
          required: ["period", "type"]
        }
      }
    ];
  }

  private async handleFunctionCall(
    functionName: string,
    argumentsJson: string,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const args = JSON.parse(argumentsJson);
      console.log(`🔧 Function call: ${functionName}`, args);

      if (functionName === "register_transaction") {
        return await this.registerTransaction(args, userContext);
      }

      if (functionName === "register_multiple_transactions") {
        return await this.registerMultipleTransactions(args, userContext);
      }

      if (functionName === "smart_financial_query") {
        return await this.executeSmartQuery(args, userContext);
      }

      return {
        message: "Função não reconhecida.",
        success: false,
      };
    } catch (error) {
      console.error('Error handling function call:', error);
      return {
        message: "😔 Ocorreu um erro ao processar sua solicitação. Tente novamente.",
        success: false,
      };
    }
  }

  private async executeSmartQuery(args: any, userContext: UserContext): Promise<BotResponse> {
    try {
      console.log('🧠 Smart Financial Query - Args:', JSON.stringify(args, null, 2));
      
      const { period, type, category, comparison, specificDay, startDate: customStart, endDate: customEnd } = args;
      
      // Calcular período principal
      const dateRange = this.calculateDateRanges(period, specificDay, customStart, customEnd);
      console.log('📅 Main period range:', dateRange);
      
      // Buscar dados do período principal
      const mainData = await this.fetchFinancialData(
        userContext.userId, 
        type, 
        dateRange.startDate, 
        dateRange.endDate, 
        category
      );
      
      let response = this.formatFinancialResponse(mainData, period, type, category, userContext.username);
      
      // Se há comparação, buscar dados do período de comparação
      if (comparison) {
        console.log('🔄 Comparison requested:', comparison);
        
        const comparisonRange = this.calculateDateRanges(
          comparison.period, 
          comparison.specificDay, 
          comparison.startDate, 
          comparison.endDate
        );
        
        const comparisonData = await this.fetchFinancialData(
          userContext.userId,
          type,
          comparisonRange.startDate,
          comparisonRange.endDate, 
          category
        );
        
        response += this.formatComparisonResponse(mainData, comparisonData, period, comparison.period);
      }
      
      return {
        message: response,
        success: true,
        data: { mainData, comparison: comparison ? true : false }
      };
      
    } catch (error) {
      console.error('❌ Error in smart financial query:', error);
      return {
        message: "😔 Erro ao consultar suas finanças. Tente novamente.",
        success: false
      };
    }
  }

  private calculateDateRanges(period: string, specificDay?: string, customStart?: string, customEnd?: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Helper para início da semana (segunda-feira)
    const getWeekStart = (date: Date) => {
      const dayOfWeek = date.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Se domingo (0), volta 6 dias
      return new Date(date.getTime() + diff * 24 * 60 * 60 * 1000);
    };
    
    // Helper para fim da semana (domingo)  
    const getWeekEnd = (date: Date) => {
      const weekStart = getWeekStart(date);
      return new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    };

    switch (period) {
      case "today":
        return {
          startDate: new Date(today),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case "yesterday": 
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          startDate: yesterday,
          endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case "week":
        return {
          startDate: getWeekStart(today),
          endDate: getWeekEnd(today)
        };
        
      case "last_week":
        const lastWeekStart = new Date(getWeekStart(today).getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          startDate: lastWeekStart,
          endDate: new Date(lastWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
        };
        
      case "month":
        return {
          startDate: new Date(today.getFullYear(), today.getMonth(), 1),
          endDate: today
        };
        
      case "last_month":
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: lastMonth,
          endDate: lastMonthEnd
        };
        
      case "year":
        return {
          startDate: new Date(today.getFullYear(), 0, 1),
          endDate: today
        };
        
      case "custom":
        if (specificDay) {
          const specific = new Date(specificDay);
          return {
            startDate: specific,
            endDate: new Date(specific.getTime() + 24 * 60 * 60 * 1000 - 1)
          };
        }
        if (customStart && customEnd) {
          return {
            startDate: new Date(customStart),
            endDate: new Date(customEnd)
          };
        }
        break;
    }
    
    // Fallback para hoje
    return {
      startDate: today,
      endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
    };
  }

  private async fetchFinancialData(userId: string, type: string, startDate: Date, endDate: Date, category?: string) {
    try {
      console.log(`🔍 Fetching ${type} data from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      switch (type) {
        case "expenses":
          const expenses = await storage.getTransactionsByUserAndType(userId, 'expense', startDate, endDate, category);
          const totalExpenses = expenses.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
          return { transactions: expenses, total: totalExpenses, type: 'expense' };
          
        case "income":
          const income = await storage.getTransactionsByUserAndType(userId, 'income', startDate, endDate, category);
          const totalIncome = income.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
          return { transactions: income, total: totalIncome, type: 'income' };
          
        case "balance":
          const balance = await storage.getUserBalance(userId, startDate, endDate);
          return { balance, type: 'balance' };
          
        case "summary":
          const allTransactions = await storage.getTransactionsByUser(userId, startDate, endDate);
          const summary = await storage.getUserBalance(userId, startDate, endDate);
          
          // Agrupar por categorias
          const byCategory = allTransactions.reduce((acc: any, t: any) => {
            const cat = t.categoryId || 'Outros';
            if (!acc[cat]) acc[cat] = { income: 0, expense: 0 };
            acc[cat][t.type] += parseFloat(t.amount);
            return acc;
          }, {});
          
          return { summary, byCategory, transactions: allTransactions, type: 'summary' };
          
        case "detailed":
          const detailed = await storage.getTransactionsByUser(userId, startDate, endDate);
          const grouped = detailed.reduce((acc: any, t: any) => {
            const cat = t.description || 'Outros';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(t);
            return acc;
          }, {});
          return { grouped, transactions: detailed, type: 'detailed' };
          
        default:
          throw new Error(`Tipo de consulta não suportado: ${type}`);
      }
    } catch (error) {
      console.error('❌ Error fetching financial data:', error);
      throw error;
    }
  }

  private formatFinancialResponse(data: any, period: string, type: string, category?: string, username?: string): string {
    const periodLabels: any = {
      today: "hoje",
      yesterday: "ontem", 
      week: "esta semana",
      last_week: "semana passada",
      month: "este mês",
      last_month: "mês passado",
      year: "este ano"
    };
    
    const periodText = periodLabels[period] || period;
    const categoryText = category ? ` em ${category}` : "";
    const greeting = username ? `${username}, ` : "";
    
    switch (type) {
      case "expenses":
        if (data.total === 0) {
          return `${greeting}você não teve gastos${categoryText} ${periodText}! 🎉`;
        }
        return `💸 ${greeting}seus gastos${categoryText} ${periodText}:\n\n💰 Total: R$ ${data.total.toFixed(2)}\n📊 ${data.transactions.length} transação(ões)`;
        
      case "income":
        if (data.total === 0) {
          return `${greeting}você não teve receitas${categoryText} ${periodText}.`;
        }
        return `💰 ${greeting}suas receitas${categoryText} ${periodText}:\n\n💵 Total: R$ ${data.total.toFixed(2)}\n📊 ${data.transactions.length} transação(ões)`;
        
      case "balance":
        const balance = data.balance.balance;
        const emoji = balance >= 0 ? "💚" : "🔴";
        return `${emoji} ${greeting}seu saldo ${periodText}:\n\n💰 Receitas: R$ ${data.balance.income.toFixed(2)}\n💸 Gastos: R$ ${data.balance.expense.toFixed(2)}\n${emoji} Saldo: R$ ${balance.toFixed(2)}`;
        
      case "summary":
        const { summary, byCategory } = data;
        let response = `📊 ${greeting}resumo financeiro ${periodText}:\n\n`;
        response += `💰 Receitas: R$ ${summary.income.toFixed(2)}\n`;
        response += `💸 Gastos: R$ ${summary.expense.toFixed(2)}\n`;
        response += `💚 Saldo: R$ ${summary.balance.toFixed(2)}\n\n`;
        
        if (Object.keys(byCategory).length > 0) {
          response += `📈 Por categoria:\n`;
          Object.entries(byCategory).forEach(([cat, values]: [string, any]) => {
            if (values.expense > 0) {
              response += `• ${cat}: R$ ${values.expense.toFixed(2)}\n`;
            }
          });
        }
        return response;
        
      default:
        return `${greeting}consulta realizada com sucesso! ✅`;
    }
  }

  private formatComparisonResponse(mainData: any, comparisonData: any, mainPeriod: string, comparisonPeriod: string): string {
    const periodLabels: any = {
      today: "hoje",
      yesterday: "ontem",
      week: "esta semana", 
      last_week: "semana passada",
      month: "este mês",
      last_month: "mês passado"
    };
    
    const mainTotal = mainData.total || mainData.balance?.expense || 0;
    const comparisonTotal = comparisonData.total || comparisonData.balance?.expense || 0;
    
    const difference = mainTotal - comparisonTotal;
    const percentChange = comparisonTotal > 0 ? ((difference / comparisonTotal) * 100) : 0;
    
    let response = `\n\n🔄 Comparação:\n`;
    response += `📊 ${periodLabels[mainPeriod]}: R$ ${mainTotal.toFixed(2)}\n`;
    response += `📊 ${periodLabels[comparisonPeriod]}: R$ ${comparisonTotal.toFixed(2)}\n`;
    
    if (difference > 0) {
      response += `📈 Diferença: +R$ ${difference.toFixed(2)} (${percentChange.toFixed(1)}% maior)`;
    } else if (difference < 0) {
      response += `📉 Diferença: R$ ${difference.toFixed(2)} (${Math.abs(percentChange).toFixed(1)}% menor)`;
    } else {
      response += `⚖️ Valores iguais!`;
    }
    
    return response;
  }

  // MÉTODOS EXISTENTES (mantidos da versão original)
  private async registerTransaction(transactionData: TransactionData, userContext: UserContext): Promise<BotResponse> {
    try {
      console.log('💰 Registering transaction:', transactionData);

      // Validate required fields
      if (!transactionData.amount || !transactionData.type || !transactionData.description) {
        return {
          message: "😔 Dados incompletos. Preciso do valor, tipo e descrição da transação.",
          success: false,
        };
      }

      // Set default date if not provided
      if (!transactionData.date) {
        transactionData.date = this.getTodayDate();
      }

      // Find or create category
      let category = await storage.getCategoryByName(transactionData.category);
      if (!category) {
        category = await storage.createCategory({
          name: transactionData.category,
          type: transactionData.type,
          color: this.getDefaultColor(transactionData.type),
          icon: this.getDefaultIcon(transactionData.category),
          isDefault: false,
        });
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        userId: userContext.userId,
        categoryId: category.id,
        type: transactionData.type,
        amount: Number(transactionData.amount).toFixed(2),
        description: transactionData.description,
        transactionDate: new Date(transactionData.date + 'T12:00:00.000Z'),
        source: 'bot',
      });

      const typeText = transactionData.type === 'expense' ? 'Despesa' : 'Receita';
      const emoji = transactionData.type === 'expense' ? '💸' : '💰';
      const formattedDate = this.formatDateForMessage(new Date(transactionData.date + 'T12:00:00.000Z'));

      return {
        message: `✅ ${typeText} registrada com sucesso!\n\n${emoji} R$ ${transactionData.amount.toFixed(2)}\n📝 ${transactionData.description}\n📂 ${transactionData.category}\n📅 ${formattedDate}`,
        success: true,
        data: transaction,
      };
    } catch (error) {
      console.error('Error registering transaction:', error);
      return {
        message: "😔 Erro ao registrar transação. Tente novamente.",
        success: false,
      };
    }
  }

  private async registerMultipleTransactions(data: { transactions: TransactionData[] }, userContext: UserContext): Promise<BotResponse> {
    try {
      console.log('💰 Registering multiple transactions:', data.transactions);

      const results = [];
      let totalIncome = 0;
      let totalExpense = 0;

      for (const transactionData of data.transactions) {
        // Set default date if not provided
        if (!transactionData.date) {
          transactionData.date = this.getTodayDate();
        }

        // Find or create category
        let category = await storage.getCategoryByName(transactionData.category);
        if (!category) {
          category = await storage.createCategory({
            name: transactionData.category,
            type: transactionData.type,
            color: this.getDefaultColor(transactionData.type),
            icon: this.getDefaultIcon(transactionData.category),
            isDefault: false,
          });
        }

        // Create transaction
        const transaction = await storage.createTransaction({
          userId: userContext.userId,
          categoryId: category.id,
          type: transactionData.type,
          amount: Number(transactionData.amount).toFixed(2),
          description: transactionData.description,
          transactionDate: new Date(transactionData.date),
          source: 'bot',
        });

        results.push(transaction);

        if (transactionData.type === 'income') {
          totalIncome += transactionData.amount;
        } else {
          totalExpense += transactionData.amount;
        }
      }

      let response = `✅ ${data.transactions.length} transações registradas com sucesso!\n\n`;
      
      if (totalIncome > 0) {
        response += `💰 Total de receitas: R$ ${totalIncome.toFixed(2)}\n`;
      }
      if (totalExpense > 0) {
        response += `💸 Total de despesas: R$ ${totalExpense.toFixed(2)}\n`;
      }

      response += `\n📋 Detalhes:\n`;
      data.transactions.forEach((t, index) => {
        const emoji = t.type === 'expense' ? '💸' : '💰';
        response += `${emoji} R$ ${t.amount.toFixed(2)} - ${t.description}\n`;
      });

      return {
        message: response,
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Error registering multiple transactions:', error);
      return {
        message: "😔 Erro ao registrar transações. Tente novamente.",
        success: false,
      };
    }
  }

  private async buildConversationContext(userId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      // Tentar usar funções de conversação se existirem
      if (storage.getConversationSummary && storage.getRecentConversations) {
        const summary = await storage.getConversationSummary(userId);
        const recentConversations = await storage.getRecentConversations(userId, 5);

        const context = [];

        // Add summary if available
        if (summary && summary.summary) {
          context.push({
            role: 'assistant' as const,
            content: `Contexto da conversa anterior: ${summary.summary}`,
          });
        }

        // Add recent conversations
        recentConversations.forEach(conv => {
          context.push({ role: 'user' as const, content: conv.userMessage });
          context.push({ role: 'assistant' as const, content: conv.botResponse });
        });

        return context;
      }
    } catch (error) {
      console.error('Error building conversation context (tables may not exist):', error);
    }
    
    return [];
  }

  private async saveConversationToHistory(userMessage: string, botResponse: string, userContext: UserContext): Promise<void> {
    try {
      // Tentar salvar conversa se a função existir
      if (storage.saveConversation) {
        await storage.saveConversation({
          userId: userContext.userId,
          phone: userContext.phone,
          userMessage,
          botResponse,
          messageType: 'chat',
        });

        // Update conversation summary periodically
        if (storage.getRecentConversations && storage.updateConversationSummary) {
          const recentCount = await storage.getRecentConversations(userContext.userId, 1);
          if (recentCount.length % 10 === 0) {
            // Every 10 messages, update summary
            const allRecent = await storage.getRecentConversations(userContext.userId, 20);
            const summary = this.generateConversationSummary(allRecent);
            
            await storage.updateConversationSummary(userContext.userId, userContext.phone, allRecent.length);
          }
        }
      }
    } catch (error) {
      console.error('Error saving conversation (tables may not exist):', error);
      // Continue without saving - not critical for bot functionality
    }
  }

  private generateConversationSummary(conversations: any[]): string {
    if (conversations.length === 0) return '';
    
    // Simple summary generation - in production, you might use AI for this
    const transactionKeywords = ['gastei', 'recebi', 'paguei', 'comprei', 'ganhei'];
    const queryKeywords = ['quanto', 'saldo', 'resumo', 'finanças'];
    
    let transactions = 0;
    let queries = 0;
    
    conversations.forEach(conv => {
      const message = conv.userMessage.toLowerCase();
      if (transactionKeywords.some(word => message.includes(word))) {
        transactions++;
      }
      if (queryKeywords.some(word => message.includes(word))) {
        queries++;
      }
    });
    
    return `Usuário registrou ${transactions} transações e fez ${queries} consultas financeiras nas últimas conversas.`;
  }

  private async handleBasicMessage(message: string, userContext: UserContext): Promise<BotResponse> {
    const text = message.toLowerCase().trim();
    const { username } = userContext;
    
    // Handle greetings
    if (text.match(/^(oi|olá|ola|hey|hi|hello)$/)) {
      return {
        message: `Olá ${username}! 👋 Como posso ajudar com suas finanças hoje? 

📝 Você pode me dizer coisas como:
• "gastei 50 reais no almoço"
• "recebi 100 de freelance"
• "quanto gastei este mês"

💰 Estou aqui para ajudar com suas finanças!`,
        success: true,
      };
    }
    
    // Handle time-based greetings
    if (text.match(/^(bom dia|boa tarde|boa noite)$/)) {
      const hour = new Date().getHours();
      let greeting = "Olá";
      if (hour < 12) greeting = "Bom dia";
      else if (hour < 18) greeting = "Boa tarde";
      else greeting = "Boa noite";
      
      return {
        message: `${greeting} ${username}! 🌟 

Como posso ajudar com suas finanças hoje? Você pode registrar gastos, receitas ou consultar seus dados financeiros.`,
        success: true,
      };
    }
    
    // Handle "how are you" type questions
    if (text.match(/(como vai|como está|tudo bem|beleza)/)) {
      return {
        message: `Estou bem, obrigado ${username}! 😊 

Pronto para ajudar você a organizar suas finanças. O que precisamos fazer hoje?`,
        success: true,
      };
    }
    
    // Check for transaction registration first (higher priority)
    console.log('🔍 Attempting basic transaction parsing...');
    const basicTransaction = this.parseBasicTransaction(text);
    if (basicTransaction) {
      console.log('✅ Basic transaction found, processing...');
      try {
        const result = await this.processBasicTransaction(basicTransaction, userContext);
        return result;
      } catch (error) {
        console.error('❌ Error processing basic transaction:', error);
        return {
          message: "😔 Erro ao processar transação. Tente novamente.",
          success: false,
        };
      }
    }
    
    // Check for financial queries second
    console.log('🔍 Checking for financial queries...');
    const financialQuery = this.parseBasicFinancialQuery(text);
    if (financialQuery) {
      console.log('✅ Financial query found:', financialQuery);
      try {
        const result = await this.executeSmartQuery(financialQuery, userContext);
        return result;
      } catch (error) {
        console.error('Error in financial query:', error);
        return {
          message: "😔 Erro ao consultar suas finanças. Tente novamente.",
          success: false,
        };
      }
    }
    
    // For other messages, provide helpful guidance
    return {
      message: `⚠️ Para usar todas as funcionalidades avançadas, é necessário configurar a chave da OpenAI API.

Mas posso ajudar! ${username}, você pode me dizer:
• "gastei [valor] com [descrição]"
• "recebi [valor] de [fonte]"
• "quanto gastei hoje/semana/mês"

💡 Configure a OpenAI API para funcionalidades completas de IA!`,
      success: true,
    };
  }

  private parseBasicTransaction(text: string): { amount: number; description: string; type: 'income' | 'expense'; date: string } | null {
    console.log('🔍 Parsing text:', text);
    // Simple regex patterns for basic transaction parsing
    const expensePatterns = [
      /gastei\s+(\d+(?:[.,]\d{2})?)\s+reais?\s+(?:com\s+|no\s+|na\s+|para\s+)?(.+?)(?:\s+hoje|\s+ontem|$)/i,
      /gastei\s+(\d+(?:[.,]\d{2})?)\s+(?:com\s+|no\s+|na\s+|para\s+)(.+?)(?:\s+hoje|\s+ontem|$)/i,
      /paguei\s+(\d+(?:[.,]\d{2})?)\s+(?:reais?\s+)?(?:de\s+|para\s+|com\s+)?(.+?)(?:\s+hoje|\s+ontem|$)/i,
      /comprei\s+(.+?)\s+(?:por\s+)?(\d+(?:[.,]\d{2})?)\s+(?:reais?)?\s*(?:hoje|ontem)?/i,
    ];
    
    const incomePatterns = [
      /recebi\s+(\d+(?:[.,]\d{2})?)\s+(?:reais?\s+)?(?:de\s+)?(.+?)(?:\s+hoje|\s+ontem|$)/i,
      /ganhei\s+(\d+(?:[.,]\d{2})?)\s+(?:reais?\s+)?(?:de\s+|com\s+)?(.+?)(?:\s+hoje|\s+ontem|$)/i,
    ];

    // Check for expenses
    for (const pattern of expensePatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(',', '.'));
        const description = pattern === expensePatterns[3] ? match[1] : match[2];
        const hasOntem = text.includes('ontem');
        const date = hasOntem ? this.getYesterdayDate() : this.getTodayDate();
        
        return {
          amount,
          description: description.trim(),
          type: 'expense',
          date
        };
      }
    }

    // Check for income
    for (const pattern of incomePatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(',', '.'));
        const description = match[2];
        const hasOntem = text.includes('ontem');
        const date = hasOntem ? this.getYesterdayDate() : this.getTodayDate();
        
        return {
          amount,
          description: description.trim(),
          type: 'income',
          date
        };
      }
    }

    return null;
  }

  private parseBasicFinancialQuery(text: string): any | null {
    const today = new Date();
    
    // Patterns for financial queries
    const patterns = [
      { regex: /quanto\s+gastei\s+hoje/i, args: { period: 'today', type: 'expenses' } },
      { regex: /quanto\s+gastei\s+ontem/i, args: { period: 'yesterday', type: 'expenses' } },
      { regex: /quanto\s+gastei\s+(?:esta\s+)?semana/i, args: { period: 'week', type: 'expenses' } },
      { regex: /quanto\s+gastei\s+semana\s+passada/i, args: { period: 'last_week', type: 'expenses' } },
      { regex: /quanto\s+gastei\s+(?:este\s+)?m[eê]s/i, args: { period: 'month', type: 'expenses' } },
      { regex: /quanto\s+recebi\s+hoje/i, args: { period: 'today', type: 'income' } },
      { regex: /quanto\s+recebi\s+(?:este\s+)?m[eê]s/i, args: { period: 'month', type: 'income' } },
      { regex: /(?:meu\s+)?saldo/i, args: { period: 'month', type: 'balance' } },
      { regex: /(?:como\s+est[aã]o\s+)?(?:minhas\s+)?finan[cç]as/i, args: { period: 'month', type: 'summary' } },
      { regex: /resumo/i, args: { period: 'month', type: 'summary' } }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(text)) {
        return pattern.args;
      }
    }

    return null;
  }

  private async processBasicTransaction(transactionData: any, userContext: UserContext) {
    // Infer category
    const category = this.inferCategory(transactionData.description, transactionData.type);
    
    const fullTransactionData = {
      ...transactionData,
      category
    };

    return await this.registerTransaction(fullTransactionData, userContext);
  }

  private inferCategory(description: string, type: 'income' | 'expense'): string {
    const text = description.toLowerCase();
    
    if (type === 'income') {
      if (text.includes('salário') || text.includes('salario')) return 'Salário';
      if (text.includes('freelance') || text.includes('freela')) return 'Freelance';
      return 'Outros';
    }
    
    // Expense categories
    if (text.includes('almoço') || text.includes('almoco') || text.includes('jantar') || 
        text.includes('comida') || text.includes('lanche') || text.includes('café') || 
        text.includes('cafe') || text.includes('restaurante')) return 'Alimentação';
    
    if (text.includes('uber') || text.includes('taxi') || text.includes('ônibus') || 
        text.includes('onibus') || text.includes('gasolina') || text.includes('combustível') || 
        text.includes('combustivel')) return 'Transporte';
    
    if (text.includes('farmácia') || text.includes('farmacia') || text.includes('médico') || 
        text.includes('medico') || text.includes('hospital')) return 'Saúde';
    
    if (text.includes('cinema') || text.includes('festa') || text.includes('bar') || 
        text.includes('diversão') || text.includes('diversao')) return 'Lazer';
    
    if (text.includes('roupa') || text.includes('sapato') || text.includes('tênis') || 
        text.includes('tenis')) return 'Roupas';
    
    return 'Outros';
  }

  private getDefaultColor(type: 'income' | 'expense'): string {
    return type === 'income' ? '#22c55e' : '#ef4444';
  }

  private getDefaultIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'Alimentação': '🍽️',
      'Transporte': '🚗',
      'Saúde': '🏥',
      'Lazer': '🎉',
      'Roupas': '👕',
      'Salário': '💼',
      'Freelance': '💻',
      'Outros': '📦'
    };
    return icons[category] || '📦';
  }

  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  private formatDateForMessage(date: Date | string): string {
    try {
      // Se receber string, converte para Date
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Verifica se a data é válida
      if (!dateObj || isNaN(dateObj.getTime())) {
        // Fallback para data atual se inválida
        const today = new Date();
        return today.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      return dateObj.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      // Retorna data atual como fallback
      return new Date().toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  }
}