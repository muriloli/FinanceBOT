import { WhatsAppMessage } from './types';

export class WhatsAppClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.ZAPI_BASE_URL || '';
    this.token = process.env.ZAPI_TOKEN || '';
    
    if (!this.baseUrl || !this.token) {
      console.warn('WhatsApp API credentials not configured. Bot will run in mock mode.');
    }
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock WhatsApp message to ${to}: ${message}`);
        return true;
      }

      const response = await fetch(`${this.baseUrl}/send-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: to,
          message: message,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send WhatsApp message:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  async downloadMedia(mediaId: string): Promise<Buffer | null> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock WhatsApp media download for ${mediaId}`);
        return null;
      }

      const response = await fetch(`${this.baseUrl}/download-media/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to download media:', await response.text());
        return null;
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Error downloading media:', error);
      return null;
    }
  }

  async sendTypingIndicator(to: string): Promise<void> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock WhatsApp typing indicator to ${to}`);
        return;
      }

      await fetch(`${this.baseUrl}/send-typing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: to,
        }),
      });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming Brazil +55)
    if (!cleaned.startsWith('55')) {
      return `55${cleaned}`;
    }
    
    return cleaned;
  }
}
