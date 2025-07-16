import { Router, Request, Response } from 'express';
import { MessageRouter } from './message-router';
import { WhatsAppMessage } from './types';

export class WebhookHandler {
  private router: Router;
  private messageRouter: MessageRouter;

  constructor() {
    this.router = Router();
    this.messageRouter = new MessageRouter();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // GET para verificação do webhook (Z-API)
    this.router.get('/webhook/whatsapp', this.verifyWebhook.bind(this));
    
    // POST para receber mensagens (Z-API)
    this.router.post('/webhook/whatsapp', this.handleWebhook.bind(this));
    
    // Endpoint de status
    this.router.get('/status', this.getStatus.bind(this));
  }

  private verifyWebhook(req: Request, res: Response): void {
    try {
      // Z-API verification
      const token = req.query.token;
      const expectedToken = process.env.ZAPI_TOKEN;

      if (token === expectedToken) {
        console.log('✅ Z-API Webhook verified successfully');
        res.status(200).send('Webhook verified');
      } else {
        console.log('❌ Z-API Webhook verification failed');
        res.status(403).send('Forbidden');
      }
    } catch (error) {
      console.error('Error verifying Z-API webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('📨 Received Z-API webhook:', JSON.stringify(req.body, null, 2));

      // Verificar se é uma mensagem válida do Z-API
      if (!this.isValidZAPIMessage(req.body)) {
        console.log('⚠️ Invalid Z-API message format');
        res.status(200).send('OK');
        return;
      }

      const message = this.parseZAPIMessage(req.body);
      
      if (message) {
        console.log(`Processing message: ${message.id}`);
        await this.messageRouter.routeMessage(message);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling Z-API webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  private isValidZAPIMessage(body: any): boolean {
    // Z-API envia mensagens com esta estrutura
    return (
      body &&
      (body.phone || body.from) &&
      (body.text || body.audio || body.image || body.document)
    );
  }

  private parseZAPIMessage(body: any): WhatsAppMessage | null {
    try {
      // Estrutura do Z-API pode variar, adaptando para formato padrão
      const messageId = body.messageId || body.id || `zapi_${Date.now()}`;
      const from = body.phone || body.from || '';
      const timestamp = body.timestamp || Date.now();

      // Determinar tipo de mensagem
      let messageType: 'text' | 'audio' | 'image' | 'video' | 'document' = 'text';
      let messageContent: any = {};

      if (body.text && body.text.message) {
        messageType = 'text';
        messageContent = {
          text: {
            body: body.text.message
          }
        };
      } else if (body.audio) {
        messageType = 'audio';
        messageContent = {
          audio: {
            id: body.audio.audioId || body.audio.id,
            mime_type: body.audio.mimeType || 'audio/ogg',
            sha256: body.audio.sha256 || '',
            size: body.audio.fileSize || 0,
            voice: true
          }
        };
      } else if (body.image) {
        messageType = 'image';
        messageContent = {
          image: {
            id: body.image.imageId || body.image.id,
            mime_type: body.image.mimeType || 'image/jpeg',
            sha256: body.image.sha256 || '',
            caption: body.image.caption || ''
          }
        };
      } else if (body.document) {
        messageType = 'document';
        messageContent = {
          document: {
            id: body.document.documentId || body.document.id,
            filename: body.document.fileName || 'document',
            mime_type: body.document.mimeType || 'application/octet-stream'
          }
        };
      }

      const message: WhatsAppMessage = {
        id: messageId,
        from: this.formatPhoneNumber(from),
        to: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        timestamp: typeof timestamp === 'number' ? timestamp : parseInt(timestamp),
        type: messageType,
        ...messageContent
      };

      console.log('✅ Parsed Z-API message:', message);
      return message;

    } catch (error) {
      console.error('Error parsing Z-API message:', error);
      return null;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove caracteres especiais e garante formato padrão
    let formatted = phone.replace(/\D/g, '');
    
    // Se não começar com 55, adiciona
    if (!formatted.startsWith('55')) {
      formatted = '55' + formatted;
    }
    
    return formatted;
  }

  private getStatus(req: Request, res: Response): void {
    res.json({
      status: 'active',
      service: 'FinanceFlow WhatsApp Bot',
      provider: 'Z-API',
      timestamp: new Date().toISOString(),
      configured: !!(process.env.ZAPI_BASE_URL && process.env.ZAPI_TOKEN)
    });
  }

  public getRouter(): Router {
    return this.router;
  }
}