import fetch from 'node-fetch';

export class WhatsAppClient {
  private baseUrl: string;
  private token: string;
  private clientToken: string;

  constructor() {
    this.baseUrl = process.env.ZAPI_BASE_URL || '';
    this.token = process.env.ZAPI_TOKEN || '';
    this.clientToken = process.env.ZAPI_CLIENT_TOKEN || '';

    if (!this.baseUrl || !this.token) {
      console.warn('Z-API credentials not configured. WhatsApp client will run in mock mode.');
    }
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock WhatsApp message to ${to}: ${message}`);
        return true;
      }

      const formattedPhone = this.formatPhoneNumber(to);
      
      const response = await fetch(`${this.baseUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Z-API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Message sent via Z-API to ${formattedPhone}`);
      return true;

    } catch (error) {
      console.error('Error sending WhatsApp message via Z-API:', error);
      // Fallback para mock em caso de erro
      console.log(`Mock WhatsApp message to ${to}: ${message}`);
      return false;
    }
  }

  async sendTypingIndicator(to: string): Promise<void> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock WhatsApp typing indicator to ${to}`);
        return;
      }

      const formattedPhone = this.formatPhoneNumber(to);

      await fetch(`${this.baseUrl}/send-presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          status: 'typing',
        }),
      });

    } catch (error) {
      console.error('Error sending typing indicator via Z-API:', error);
      console.log(`Mock WhatsApp typing indicator to ${to}`);
    }
  }

  async downloadMedia(mediaId: string): Promise<Buffer | null> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock media download for ID: ${mediaId}`);
        return null;
      }

      const response = await fetch(`${this.baseUrl}/download-media/${mediaId}`, {
        method: 'GET',
        headers: {
          'Client-Token': this.clientToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Z-API Media Download Error: ${response.status}`);
      }

      const buffer = await response.buffer();
      console.log(`✅ Media downloaded via Z-API: ${mediaId}`);
      return buffer;

    } catch (error) {
      console.error('Error downloading media via Z-API:', error);
      return null;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove caracteres especiais e espaços
    let formatted = phone.replace(/\D/g, '');
    
    // Se não começar com código do país, adiciona +55 (Brasil)
    if (!formatted.startsWith('55')) {
      formatted = '55' + formatted;
    }
    
    // Garante que tenha o formato correto para Z-API
    // Z-API espera: 5511999999999 (sem + ou outros caracteres)
    return formatted;
  }

  async getInstanceStatus(): Promise<boolean> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log('Z-API not configured, returning mock status');
        return false;
      }

      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: {
          'Client-Token': this.clientToken,
        },
      });

      if (!response.ok) {
        return false;
      }

      const result: any = await response.json();
      const isConnected = result.connected === true;
      
      console.log(`Z-API Instance Status: ${isConnected ? 'Connected' : 'Disconnected'}`);
      return isConnected;

    } catch (error) {
      console.error('Error checking Z-API status:', error);
      return false;
    }
  }

  async sendDocument(to: string, documentUrl: string, filename: string): Promise<boolean> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock document send to ${to}: ${filename}`);
        return true;
      }

      const formattedPhone = this.formatPhoneNumber(to);

      const response = await fetch(`${this.baseUrl}/send-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          document: documentUrl,
          fileName: filename,
        }),
      });

      return response.ok;

    } catch (error) {
      console.error('Error sending document via Z-API:', error);
      return false;
    }
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<boolean> {
    try {
      if (!this.baseUrl || !this.token) {
        console.log(`Mock image send to ${to}: ${caption || 'No caption'}`);
        return true;
      }

      const formattedPhone = this.formatPhoneNumber(to);

      const response = await fetch(`${this.baseUrl}/send-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          image: imageUrl,
          caption: caption || '',
        }),
      });

      return response.ok;

    } catch (error) {
      console.error('Error sending image via Z-API:', error);
      return false;
    }
  }
}