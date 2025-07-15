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
        return this.handleBasicMessage(message, userContext);
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
        model: "gpt-4o",
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

  private handleBasicMessage(message: string, userContext: UserContext): BotResponse {
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
    
    // Try basic transaction parsing without AI
    console.log('🔍 Attempting basic transaction parsing...');
    const basicTransaction = this.parseBasicTransaction(text);
    if (basicTransaction) {
      console.log('✅ Basic transaction found, processing async...');
      // Process the transaction directly for testing
      setTimeout(async () => {
        try {
          const result = await this.processBasicTransaction(basicTransaction, userContext);
          console.log('✅ Basic transaction processed:', result);
        } catch (error) {
          console.error('❌ Error processing basic transaction:', error);
        }
      }, 100);
      
      // Return immediate response for now
      return {
        message: `💰 Identifiquei sua transação: ${basicTransaction.type === 'expense' ? 'Gasto' : 'Receita'} de R$ ${basicTransaction.amount}

🔧 Processando: "${basicTransaction.description}" (${basicTransaction.date === this.getTodayDate() ? 'hoje' : 'ontem'})
        
⚠️ Para funcionalidade completa, configure a OpenAI API key.`,
        success: true,
      };
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
        const description = pattern === expensePatterns[2] ? match[1] : match[2];
        const hasOntem = text.includes('ontem');
        const date = hasOntem ? this.getYesterdayDate() : this.getTodayDate();
        
        console.log('🔍 Basic transaction parsed - Expense:', { amount, description, date, hasOntem });
        
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
        
        console.log('🔍 Basic transaction parsed - Income:', { amount, description, date, hasOntem });
        
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

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  private async processBasicTransaction(
    data: { amount: number; description: string; type: 'income' | 'expense'; date: string },
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Default category based on keywords
      const category = this.inferCategory(data.description, data.type);
      
      const transactionData: TransactionData = {
        amount: data.amount,
        type: data.type,
        category,
        description: data.description,
        date: data.date
      };

      return await this.registerTransaction(transactionData, userContext);
    } catch (error) {
      console.error('Error processing basic transaction:', error);
      return {
        message: "😔 Erro ao processar transação básica. Tente novamente.",
        success: false,
      };
    }
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

  private getSystemPrompt(): string {
    const today = new Date();
    const currentDate = today.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return `Você é um assistente financeiro para o aplicativo FinanceFlow.

DATA ATUAL: ${currentDate}

REGRAS:
1. Seja amigável e responda a cumprimentos básicos como "oi", "olá", "bom dia"
2. Para conversas casuais, seja educado mas direcione para finanças de forma natural
3. Para perguntas totalmente não relacionadas a finanças, responda: "Posso ajudar principalmente com questões financeiras"
4. Sempre use function calling para registrar transações
5. Seja amigável mas conciso
6. Use português brasileiro
7. Use emojis para deixar as respostas mais amigáveis
8. SEMPRE chame o usuário pelo nome quando souber. Use o nome do contexto do usuário nas respostas.

CAPACIDADES:
- Registrar despesas e receitas
- Consultar resumos financeiros
- Fornecer insights de gastos
- Responder perguntas sobre finanças
- Conversar de forma amigável sobre tópicos relacionados

EXEMPLOS DE CUMPRIMENTOS:
- "Oi", "Olá" → Responda com "Olá [nome]! 👋 Como posso ajudar com suas finanças hoje?"
- "Bom dia", "Boa tarde" → Responda adequadamente e pergunte sobre finanças
- "Como vai?" → Seja educado e direcione para ajuda financeira

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

PROCESSAMENTO DE DATAS - CRÍTICO:
Use a data atual como referência para todos os cálculos.

REGRAS ESPECÍFICAS PARA DATAS:
- "hoje" = DATA ATUAL (${today.toISOString().split('T')[0]}) 
- "ontem" = dia anterior à data atual
- "anteontem" = dois dias antes da data atual
- "segunda passada", "terça passada", etc = último dia da semana mencionado
- "dia 14", "dia 25" = dia específico do mês atual (julho 2025)
- "dia 14 do mês passado" = dia específico do mês anterior (junho 2025)
- "segunda-feira", "terça-feira" = próximo ou último dia da semana
- Se não mencionar data, use a data atual (${today.toISOString().split('T')[0]})

MUITO IMPORTANTE: 
- Quando usuário disser "hoje", use SEMPRE a data atual: ${today.toISOString().split('T')[0]}
- Sempre passe a data no campo 'date' como string no formato 'YYYY-MM-DD'
- NUNCA confunda "hoje" com "ontem"

EXEMPLOS DE INTERPRETAÇÃO DE DATAS:
- "gastei hoje" → date: "${today.toISOString().split('T')[0]}"
- "gastei ontem" → date: "${new Date(today.getTime() - 24*60*60*1000).toISOString().split('T')[0]}"
- "recebi hoje" → date: "${today.toISOString().split('T')[0]}"
- "gasto de hoje" → date: "${today.toISOString().split('T')[0]}"

PROCESSAMENTO DE TRANSAÇÕES:
- Para UMA transação: use register_transaction
- Para MÚLTIPLAS transações na mesma mensagem: use register_multiple_transactions
- SEMPRE identifique múltiplas transações quando houver múltiplos valores ou itens
- Palavras-chave para múltiplas transações: "e", "também", "além disso", "mais", "ainda"
- Exemplo: "gastei 500 com pneu e 200 com lataria" = SEMPRE use register_multiple_transactions
- Exemplo: "recebi 1000 de salário e 500 de freelance" = SEMPRE use register_multiple_transactions
- Exemplo: "comprei comida por 50 e também paguei 30 de combustível" = register_multiple_transactions

CONSULTAS FINANCEIRAS:
Use a função query_finances para perguntas sobre gastos, receitas ou saldos.

EXEMPLOS DE CONSULTAS:
- "quanto gastei hoje?" → query_finances: period="today", type="expenses"
- "quanto gastei ontem?" → query_finances: period="yesterday", type="expenses"
- "quanto gastei esta semana?" → query_finances: period="week", type="expenses"
- "quanto gastei semana passada?" → query_finances: period="last_week", type="expenses"
- "quanto gastei este mês?" → query_finances: period="month", type="expenses"
- "quanto gastei mês passado?" → query_finances: period="last_month", type="expenses"
- "quanto recebi hoje?" → query_finances: period="today", type="income"
- "resumo financeiro de hoje" → query_finances: period="today", type="summary"
- "meu saldo hoje" → query_finances: period="today", type="balance"
- "quanto gastei com alimentação esta semana?" → query_finances: period="week", type="expenses", category="Alimentação"
- "quanto gastei hoje vs ontem?" → query_finances: period="today", type="expenses", comparison={period="yesterday"}

TIPOS DE CONSULTA:
- "expenses" para gastos/despesas
- "income" para receitas/ganhos
- "summary" ou "balance" para resumo completo
- Use "comparison" para comparar períodos diferentes

PERÍODOS VÁLIDOS:
- "today" = hoje
- "yesterday" = ontem
- "week" = esta semana
- "last_week" = semana passada
- "month" = este mês
- "last_month" = mês passado
- "year" = este ano
- "last_year" = ano passado`;
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
              description: "Data da transação no formato YYYY-MM-DD. IMPORTANTE: Se o usuário disser 'hoje', use SEMPRE a data atual (2025-07-15). Para 'ontem', use 2025-07-14. Se não especificado, use a data atual.",
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
                    description: "Data da transação no formato YYYY-MM-DD. IMPORTANTE: Se o usuário disser 'hoje', use SEMPRE a data atual (2025-07-15). Para 'ontem', use 2025-07-14. Se não especificado, use a data atual.",
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
        name: "query_finances",
        description: "Consultar informações financeiras do usuário - suporta períodos flexíveis e comparações",
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "yesterday", "week", "last_week", "month", "last_month", "year", "last_year", "custom"],
              description: "Período da consulta",
            },
            type: {
              type: "string",
              enum: ["summary", "expenses", "income", "balance"],
              description: "Tipo de consulta",
            },
            category: {
              type: "string",
              description: "Categoria específica para filtrar (opcional)",
            },
            startDate: {
              type: "string",
              format: "date",
              description: "Data inicial para período customizado (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              format: "date",
              description: "Data final para período customizado (YYYY-MM-DD)",
            },
            comparison: {
              type: "object",
              properties: {
                period: {
                  type: "string",
                  enum: ["today", "yesterday", "week", "last_week", "month", "last_month", "year", "last_year", "custom"],
                  description: "Período para comparação",
                },
                startDate: {
                  type: "string",
                  format: "date",
                  description: "Data inicial para comparação (YYYY-MM-DD)",
                },
                endDate: {
                  type: "string",
                  format: "date",
                  description: "Data final para comparação (YYYY-MM-DD)",
                },
              },
              required: ["period"],
              description: "Parâmetros para comparação entre períodos (opcional)",
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

      if (functionName === "register_multiple_transactions") {
        return await this.registerMultipleTransactions(args, userContext);
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

      // Parse and validate date with detailed logging
      let transactionDate: Date;
      console.log('📅 Date processing - Raw date received:', data.date);
      
      if (data.date) {
        transactionDate = new Date(data.date);
        console.log('📅 Date processing - Parsed date:', transactionDate.toISOString());
        console.log('📅 Date processing - Local date string:', transactionDate.toLocaleDateString('pt-BR'));
      } else {
        transactionDate = new Date();
        console.log('📅 Date processing - Using current date:', transactionDate.toLocaleDateString('pt-BR'));
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        userId: userContext.userId,
        amount: data.amount.toString(),
        type: data.type,
        categoryId: category.id,
        description: data.description,
        transactionDate: transactionDate,
        source: 'whatsapp',
      });

      const typeEmoji = data.type === 'income' ? '💰' : '💸';
      const dateStr = this.formatDateForMessage(transactionDate);
      
      console.log('💬 Message generation - Final dateStr:', dateStr);
      console.log('💬 Message generation - Transaction date:', transactionDate.toISOString());
      
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

  private async registerMultipleTransactions(
    data: { transactions: TransactionData[] },
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const results = [];
      let totalAmount = 0;
      
      for (const transactionData of data.transactions) {
        // Find or create category
        let category = await storage.getCategoryByName(transactionData.category, userContext.userId);
        if (!category) {
          category = await storage.createCategory({
            name: transactionData.category,
            type: transactionData.type,
            color: '#6B7280',
            icon: 'category',
            isDefault: false,
          });
        }

        // Parse date
        const transactionDate = transactionData.date ? new Date(transactionData.date) : new Date();

        // Create transaction
        const transaction = await storage.createTransaction({
          userId: userContext.userId,
          amount: transactionData.amount.toString(),
          type: transactionData.type,
          categoryId: category.id,
          description: transactionData.description,
          transactionDate: transactionDate,
          source: 'whatsapp',
        });

        results.push({
          ...transactionData,
          transaction,
          dateStr: this.formatDateForMessage(transactionDate)
        });

        totalAmount += transactionData.amount;
      }

      // Create summary message
      const transactionType = results[0].type;
      const typeEmoji = transactionType === 'income' ? '💰' : '💸';
      const typeText = transactionType === 'income' ? 'Receitas' : 'Despesas';
      
      let message = `✅ ${results.length} ${typeText.toLowerCase()} registradas!\n\n`;
      
      results.forEach((result, index) => {
        message += `${index + 1}. ${typeEmoji} R$ ${result.amount.toFixed(2).replace('.', ',')} - ${result.category}\n`;
        message += `   📝 ${result.description}\n`;
        message += `   📅 ${result.dateStr}\n\n`;
      });

      message += `💰 Total: R$ ${totalAmount.toFixed(2).replace('.', ',')}`;

      return {
        message,
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Error registering multiple transactions:', error);
      return {
        message: "😔 Erro ao registrar algumas transações. Tente novamente.",
        success: false,
      };
    }
  }

  private async queryFinances(
    query: FinancialQuery,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const { startDate, endDate } = this.getPeriodDates(query.period, query.startDate, query.endDate);
      
      // Debug logs
      console.log('🔍 Query finances debug:');
      console.log('- Period:', query.period);
      console.log('- Type:', query.type);
      console.log('- Category:', query.category);
      console.log('- Start date:', startDate.toISOString());
      console.log('- End date:', endDate.toISOString());
      console.log('- User ID:', userContext.userId);
      
      // Handle comparison queries
      if (query.comparison) {
        return await this.handleComparisonQuery(query, userContext, startDate, endDate);
      }
      
      if (query.type === 'summary' || query.type === 'balance') {
        const balance = await storage.getUserBalance(userContext.userId, startDate, endDate);
        
        const periodText = this.getPeriodText(query.period);
        let message = `📊 Resumo Financeiro - ${periodText}`;
        
        if (query.category) {
          message += ` (${query.category})`;
        }
        
        message += `
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
        console.log('🔍 About to call getTransactionsByUserAndType with:');
        console.log('- userId:', userContext.userId);
        console.log('- type:', query.type);
        console.log('- startDate:', startDate);
        console.log('- endDate:', endDate);
        console.log('- category:', query.category);
        
        const transactions = await storage.getTransactionsByUserAndType(
          userContext.userId,
          query.type as 'income' | 'expense',
          startDate,
          endDate,
          query.category
        );

        const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const typeEmoji = query.type === 'income' ? '💰' : '💸';
        const typeText = query.type === 'income' ? 'Receitas' : 'Despesas';
        const periodText = this.getPeriodText(query.period);

        let message = `${typeEmoji} ${typeText} - ${periodText}`;
        
        if (query.category) {
          message += ` (${query.category})`;
        }
        
        message += `
Total: R$ ${total.toFixed(2).replace('.', ',')}`;

        if (transactions.length > 0) {
          message += '\n\n📋 Transações:';
          transactions.slice(0, 10).forEach(t => {
            const date = new Date(t.transactionDate);
            const dateStr = this.formatDateForMessage(date);
            message += `\n• R$ ${Number(t.amount).toFixed(2).replace('.', ',')} - ${t.description} (${dateStr})`;
          });
          
          if (transactions.length > 10) {
            message += `\n... e mais ${transactions.length - 10} transações`;
          }
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

  private async handleComparisonQuery(
    query: FinancialQuery,
    userContext: UserContext,
    startDate: Date,
    endDate: Date
  ): Promise<BotResponse> {
    try {
      const { startDate: compStartDate, endDate: compEndDate } = this.getPeriodDates(
        query.comparison!.period,
        query.comparison!.startDate,
        query.comparison!.endDate
      );

      // Get data for both periods
      const [currentData, comparisonData] = await Promise.all([
        this.getFinancialData(query, userContext, startDate, endDate),
        this.getFinancialData(query, userContext, compStartDate, compEndDate)
      ]);

      const periodText = this.getPeriodText(query.period);
      const comparisonPeriodText = this.getPeriodText(query.comparison!.period);
      
      let message = `📊 Comparação - ${query.category || 'Todas categorias'}

${periodText}:
`;

      if (query.type === 'expenses' || query.type === 'income') {
        const typeEmoji = query.type === 'income' ? '💰' : '💸';
        const currentTotal = currentData.reduce((sum, t) => sum + Number(t.amount), 0);
        const comparisonTotal = comparisonData.reduce((sum, t) => sum + Number(t.amount), 0);
        const difference = currentTotal - comparisonTotal;
        const percentChange = comparisonTotal > 0 ? ((difference / comparisonTotal) * 100) : 0;

        message += `${typeEmoji} R$ ${currentTotal.toFixed(2).replace('.', ',')}

${comparisonPeriodText}:
${typeEmoji} R$ ${comparisonTotal.toFixed(2).replace('.', ',')}

📈 Diferença: R$ ${Math.abs(difference).toFixed(2).replace('.', ',')} ${difference >= 0 ? '(mais)' : '(menos)'}
📊 Variação: ${percentChange.toFixed(1)}%`;

        if (difference > 0) {
          message += `\n\n💡 Você gastou R$ ${difference.toFixed(2).replace('.', ',')} a mais ${periodText.toLowerCase()} comparado ${comparisonPeriodText.toLowerCase()}.`;
        } else if (difference < 0) {
          message += `\n\n💡 Você economizou R$ ${Math.abs(difference).toFixed(2).replace('.', ',')} ${periodText.toLowerCase()} comparado ${comparisonPeriodText.toLowerCase()}.`;
        } else {
          message += `\n\n💡 O gasto foi igual nos dois períodos.`;
        }
      }

      return {
        message,
        success: true,
        data: { currentData, comparisonData, difference: currentData.length - comparisonData.length },
      };
    } catch (error) {
      console.error('Error handling comparison query:', error);
      return {
        message: "😔 Erro ao fazer comparação. Tente novamente.",
        success: false,
      };
    }
  }

  private async getFinancialData(
    query: FinancialQuery,
    userContext: UserContext,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    if (query.type === 'expenses' || query.type === 'income') {
      return await storage.getTransactionsByUserAndType(
        userContext.userId,
        query.type as 'income' | 'expense',
        startDate,
        endDate,
        query.category
      );
    }
    return [];
  }

  private getPeriodDates(period: string, customStartDate?: string, customEndDate?: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date(now);

    switch (period) {
      case 'today':
        startDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate.setTime(startDate.getTime());
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Esta semana (Segunda a Domingo)
        startDate = new Date(today);
        const dayOfWeek = startDate.getDay(); // 0 = domingo, 1 = segunda
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Ajustar para segunda-feira
        startDate.setDate(today.getDate() - daysToMonday);
        break;
      case 'last_week':
        // Semana passada
        startDate = new Date(today);
        const lastWeekDayOfWeek = startDate.getDay();
        const daysToLastMonday = lastWeekDayOfWeek === 0 ? 13 : lastWeekDayOfWeek + 6;
        startDate.setDate(today.getDate() - daysToLastMonday);
        endDate.setTime(startDate.getTime());
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Este mês
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last_month':
        // Mês passado
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate.setTime(new Date(today.getFullYear(), today.getMonth(), 0).getTime());
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        // Este ano
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'last_year':
        // Ano passado
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate.setTime(new Date(today.getFullYear() - 1, 11, 31).getTime());
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate) {
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
        }
        if (customEndDate) {
          endDate.setTime(new Date(customEndDate).getTime());
          endDate.setHours(23, 59, 59, 999);
        }
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
      case 'yesterday':
        return 'Ontem';
      case 'week':
        return 'Esta semana';
      case 'last_week':
        return 'Semana passada';
      case 'month':
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
      case 'last_month':
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return `${months[lastMonth]} ${lastMonthYear}`;
      case 'year':
        return `${now.getFullYear()}`;
      case 'last_year':
        return `${now.getFullYear() - 1}`;
      default:
        return period;
    }
  }

  private formatDateForMessage(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Usar strings das datas para comparação (formato YYYY-MM-DD)
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0]; 
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Debug logs
    console.log('🗓️ formatDateForMessage - Input date:', date.toISOString());
    console.log('🗓️ formatDateForMessage - Date string:', dateStr);
    console.log('🗓️ formatDateForMessage - Today string:', todayStr);
    console.log('🗓️ formatDateForMessage - Yesterday string:', yesterdayStr);
    
    const isToday = dateStr === todayStr;
    const isYesterday = dateStr === yesterdayStr;
    
    console.log('🗓️ formatDateForMessage - isToday:', isToday);
    console.log('🗓️ formatDateForMessage - isYesterday:', isYesterday);
    
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

  private async buildConversationContext(userId: string): Promise<Array<{role: 'user' | 'assistant', content: string}>> {
    const messages: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    try {
      // Get conversation summary if exists
      const summary = await storage.getConversationSummary(userId);
      if (summary && summary.summary) {
        messages.push({
          role: 'assistant',
          content: `[RESUMO DAS CONVERSAS ANTERIORES]: ${summary.summary}`
        });
      }

      // Get recent conversations (last 5)
      const recentConversations = await storage.getRecentConversations(userId, 5);
      
      // Add recent conversations in reverse order (oldest first)
      for (const conv of recentConversations.reverse()) {
        messages.push({
          role: 'user',
          content: conv.userMessage
        });
        messages.push({
          role: 'assistant',
          content: conv.botResponse
        });
      }
    } catch (error) {
      console.error('Error building conversation context (using fallback):', error);
      // Continue without conversation history if tables don't exist
    }

    return messages;
  }

  private async saveConversationToHistory(userMessage: string, botResponse: string, userContext: UserContext): Promise<void> {
    try {
      // Determine message type
      let messageType = 'chat';
      if (userMessage.toLowerCase().includes('gastei') || userMessage.toLowerCase().includes('recebi') || 
          userMessage.toLowerCase().includes('r$') || userMessage.toLowerCase().includes('real')) {
        messageType = 'transaction';
      } else if (userMessage.toLowerCase().includes('saldo') || userMessage.toLowerCase().includes('resumo') ||
                 userMessage.toLowerCase().includes('gastos') || userMessage.toLowerCase().includes('receitas')) {
        messageType = 'query';
      }

      // Save current conversation
      await storage.saveConversation({
        userId: userContext.userId,
        phone: userContext.phone,
        userMessage,
        botResponse,
        messageType
      });

      // Get total conversation count
      const allConversations = await storage.getRecentConversations(userContext.userId, 100);
      
      // If we have more than 10 conversations, create/update summary and clean old ones
      if (allConversations.length > 10) {
        await this.updateConversationSummary(userContext.userId, allConversations);
        await storage.deleteOldConversations(userContext.userId, 5); // Keep only last 5
      }
    } catch (error) {
      console.error('Error saving conversation to history (conversation will work without history):', error);
      // Don't fail the main conversation if history saving fails
      // This allows the bot to work even without conversation_history and conversation_summary tables
    }
  }

  private async updateConversationSummary(userId: string, conversations: any[]): Promise<void> {
    try {
      // Get conversations older than the last 5 for summarization
      const conversationsToSummarize = conversations.slice(5);
      
      if (conversationsToSummarize.length === 0) return;

      // Create summary of older conversations
      const conversationText = conversationsToSummarize
        .map(conv => `Usuário: ${conv.userMessage}\nBot: ${conv.botResponse}`)
        .join('\n\n');

      const summaryPrompt = `Crie um resumo conciso das seguintes conversas financeiras, destacando:
- Principais transações registradas
- Padrões de gastos do usuário
- Categorias mais usadas
- Questões recorrentes

Conversas:
${conversationText}

Resumo (máximo 200 palavras):`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: summaryPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const summary = response.choices[0].message.content || '';
      
      // Update summary in database
      await storage.updateConversationSummary(userId, summary, conversationsToSummarize.length);
    } catch (error) {
      console.error('Error updating conversation summary:', error);
    }
  }
}
