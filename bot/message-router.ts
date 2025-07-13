import { WhatsAppMessage, BotResponse, UserContext } from './types';
import { WhatsAppClient } from './whatsapp-client';
import { SpeechHandler } from './speech-handler';
import { AIProcessor } from './ai-processor';
import { storage } from '../server/storage';

export class MessageRouter {
  private whatsappClient: WhatsAppClient;
  private speechHandler: SpeechHandler;
  private aiProcessor: AIProcessor;

  constructor() {
    this.whatsappClient = new WhatsAppClient();
    this.speechHandler = new SpeechHandler(this.whatsappClient);
    this.aiProcessor = new AIProcessor();
  }

  async routeMessage(message: WhatsAppMessage): Promise<void> {
    try {
      const userContext = await this.getUserContext(message.from);
      
      if (!userContext) {
        await this.handleUnauthenticatedUser(message.from);
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
      const formattedPhone = this.whatsappClient.formatPhoneNumber(phone);
      const user = await storage.getUserByPhone(formattedPhone);
      
      if (!user) {
        return null;
      }

      return {
        userId: user.id,
        phone: user.phone || formattedPhone,
        username: user.username,
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return null;
    }
  }

  private async handleUnauthenticatedUser(phone: string): Promise<void> {
    const message = `👋 Olá! Parece que você ainda não está cadastrado no FinanceFlow.

Para usar o bot, você precisa:
1. Fazer login no app FinanceFlow
2. Cadastrar este número de telefone em seu perfil
3. Voltar aqui e enviar uma mensagem

Após isso, poderei ajudar você a gerenciar suas finanças! 💰`;

    await this.whatsappClient.sendMessage(phone, message);
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
}
