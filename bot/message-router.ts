import { WhatsAppMessage, BotResponse, UserContext } from './types';
import { WhatsAppClient } from './whatsapp-client';
import { SpeechHandler } from './speech-handler';
import { AIProcessor } from './ai-processor';
import { storage } from '../server/storage';
import { PhoneUtils } from './phone-utils';

export class MessageRouter {
  private whatsappClient: WhatsAppClient;
  private speechHandler: SpeechHandler;
  public aiProcessor: AIProcessor;

  constructor() {
    this.whatsappClient = new WhatsAppClient();
    this.speechHandler = new SpeechHandler(this.whatsappClient);
    this.aiProcessor = new AIProcessor();
  }

  async routeMessage(message: WhatsAppMessage): Promise<void> {
    try {
      const userContext = await this.getUserContext(message.from);
      
      if (!userContext) {
        //await this.handleUnauthenticatedUser(message.from);
        return;
      }

      await this.whatsappClient.sendTypingIndicator(message.from);

      let processedMessage = '';
      let botResponse: BotResponse;

      if (message.type === 'text' && message.text) {
        processedMessage = message.text.body;
        botResponse = await this.aiProcessor.processMessage(processedMessage, userContext);
      } else if (message.type === 'audio' && message.audio) {
        const transcription = await this.speechHandler.transcribeAudio(message.audio.id);
        
        if (!transcription) {
          await this.whatsappClient.sendMessage(
            message.from,
            "😔 Desculpe, não consegui entender o áudio. Pode tentar novamente ou enviar uma mensagem de texto?"
          );
          return;
        }

        processedMessage = transcription;
        botResponse = await this.aiProcessor.processMessage(transcription, userContext);
        
        // Add audio confirmation to response
        botResponse.message = `🎙️ Entendi seu áudio: "${transcription}"\n\n${botResponse.message}`;
      } else {
        await this.whatsappClient.sendMessage(
          message.from,
          "📱 Posso ajudar com mensagens de texto ou áudio sobre suas finanças. Como posso ajudar?"
        );
        return;
      }

      await this.whatsappClient.sendMessage(message.from, botResponse.message);
    } catch (error) {
      console.error('Error routing message:', error);
      await this.whatsappClient.sendMessage(
        message.from,
        "😔 Ocorreu um erro. Tente novamente em alguns instantes."
      );
    }
    
  }

  private async getUserContext(phone: string): Promise<UserContext | null> {
    try {
      // Format phone number and generate search patterns
      const formattedPhone = PhoneUtils.formatToStandard(phone);
      const searchPatterns = PhoneUtils.generateSearchPatterns(phone);
      
      console.log(`🔍 Searching user for phone: ${phone}`);
      console.log(`📱 Formatted: ${formattedPhone}`);
      console.log(`🔎 Search patterns: ${searchPatterns.join(', ')}`);
      
      let user = null;
      
      // Try exact match first with formatted phone
      user = await storage.getUserByPhone(formattedPhone);
      
      if (!user) {
        // Try original phone number
        user = await storage.getUserByPhone(phone);
      }
      
      if (!user) {
        // Try search patterns one by one
        for (const pattern of searchPatterns) {
          user = await storage.getUserByPhoneContains(pattern);
          if (user) {
            console.log(`✅ Found user by pattern: ${pattern} -> ${user.name}`);
            break;
          }
        }
      }
      
      // 🚨 VERIFICAÇÃO 1: Usuário não encontrado
      if (!user) {
        console.log(`❌ No user found for phone: ${phone}`);
        await this.handleUserNotFound(phone);
        return null;
      }
      
      // 🚨 VERIFICAÇÃO 2: Usuário encontrado mas inativo
      if (!user.isActive) {
        console.log(`⚠️ User found but inactive: ${user.name} (ID: ${user.id})`);
        await this.handleInactiveUser(phone, user.name);
        return null;
      }
      
      // ✅ VERIFICAÇÃO 3: Usuário ativo - tudo OK
      console.log(`👤 User found and active: ${user.name} (ID: ${user.id})`);
      return {
        userId: user.id,
        phone: phone,
        username: user.name,
      };
      
    } catch (error) {
      console.error('Error getting user context:', error);
      return null;
    }
  }

async sendWelcomeMessage(phone: string): Promise<void> {
  const message = `🎉 Bem-vindo ao FinanceFlow Bot!

Agora você pode registrar suas transações financeiras diretamente pelo WhatsApp!

💬 **Como usar:**
• Envie mensagens de texto ou áudio
• Exemplo: "Gastei 50 reais no almoço"
• Exemplo: "Recebi 3000 de salário"

📊 **Consultas:**
• "Como estão minhas finanças?"
• "Quanto gastei este mês?"
• "Qual meu saldo?"

🤖 **Dicas:**
• Fale naturalmente, entendo português
• Posso processar áudios e textos
• Respondo apenas sobre finanças

Como posso ajudar você hoje? 😊`;

    await this.whatsappClient.sendMessage(phone, message);
  }

  // 📞 FUNÇÃO 1: Usuário não encontrado
  private async handleUserNotFound(phone: string): Promise<void> {
    const message = `👋 Olá! 

  ❌ Você ainda não possui cadastro em nosso sistema.

  📞 Para utilizar o FinanceFlow Bot, entre em contato conosco pelo telefone:

  *(66) 99671-6331*

  Nossa equipe te ajudará com o cadastro! 😊`;

    await this.whatsappClient.sendMessage(phone, message);
  }

  // ⛔ FUNÇÃO 2: Usuário inativo  
  private async handleInactiveUser(phone: string, userName: string): Promise<void> {
    const message = `👋 Olá ${userName}!

  ⚠️ Sua conta está *INATIVA* no momento.

  📞 Para reativar seu acesso ao FinanceFlow, entre em contato conosco:

  *(66) 99671-6331*

  Nossa equipe te ajudará a reativar sua conta! 💙`;

    await this.whatsappClient.sendMessage(phone, message);
  }

}
