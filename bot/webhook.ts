import express, { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from './types';
import { MessageRouter } from './message-router';
import crypto from 'crypto';

export class WebhookHandler {
  private router: express.Router;
  private messageRouter: MessageRouter;
  private webhookSecret: string;

  constructor() {
    this.router = express.Router();
    this.messageRouter = new MessageRouter();
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'financeflow-webhook-secret';
    console.log('Webhook secret configured:', this.webhookSecret);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Webhook verification endpoint
    this.router.get('/webhook/whatsapp', (req: Request, res: Response) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === this.webhookSecret) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        console.error('Webhook verification failed');
        res.status(403).send('Forbidden');
      }
    });

    // Webhook message handler
    this.router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
      try {
        const signature = req.headers['x-hub-signature-256'] as string;
        
        // Skip signature verification for testing when using default webhook secret
        if (this.webhookSecret !== 'financeflow-webhook-secret' && !this.verifySignature(req.body, signature)) {
          console.error('Invalid webhook signature');
          return res.status(401).send('Unauthorized');
        }

        const payload: WhatsAppWebhookPayload = req.body;
        await this.handleWebhookPayload(payload);
        
        res.status(200).send('OK');
      } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Health check endpoint
    this.router.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'FinanceFlow WhatsApp Bot',
      });
    });
  }

  private verifySignature(payload: any, signature: string): boolean {
    if (!signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const receivedSignature = signature.replace('sha256=', '');
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  private async handleWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value.messages) {
          for (const message of change.value.messages) {
            console.log('Processing message:', message.id);
            await this.messageRouter.routeMessage(message);
          }
        }
      }
    }
  }

  getRouter(): express.Router {
    return this.router;
  }

  getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }
}
