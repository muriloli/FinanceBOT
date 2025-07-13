import { WhatsAppClient } from './whatsapp-client';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SpeechHandler {
  private whatsappClient: WhatsAppClient;
  private azureSpeechKey: string;
  private azureSpeechRegion: string;

  constructor(whatsappClient: WhatsAppClient) {
    this.whatsappClient = whatsappClient;
    this.azureSpeechKey = process.env.AZURE_SPEECH_KEY || '';
    this.azureSpeechRegion = process.env.AZURE_SPEECH_REGION || 'eastus';
    
    if (!this.azureSpeechKey) {
      console.warn('Azure Speech API key not configured. Speech recognition will be disabled.');
    }
  }

  async transcribeAudio(audioId: string): Promise<string | null> {
    try {
      // Check if Azure Speech API key is configured
      if (!this.azureSpeechKey) {
        console.warn('Azure Speech API key not configured. Cannot transcribe audio.');
        return null;
      }

      // Download audio file from WhatsApp
      const audioBuffer = await this.whatsappClient.downloadMedia(audioId);
      if (!audioBuffer) {
        console.error('Failed to download audio file');
        return null;
      }

      // Save temporary audio file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempAudioPath = path.join(tempDir, `${audioId}.ogg`);
      const tempWavPath = path.join(tempDir, `${audioId}.wav`);

      fs.writeFileSync(tempAudioPath, audioBuffer);

      // Convert to WAV format if needed (Azure Speech API works better with WAV)
      try {
        await execAsync(`ffmpeg -i "${tempAudioPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${tempWavPath}"`);
      } catch (ffmpegError) {
        console.warn('FFmpeg conversion failed, using original file:', ffmpegError);
        fs.copyFileSync(tempAudioPath, tempWavPath);
      }

      // Transcribe using Azure Speech API
      const transcription = await this.callAzureSpeechAPI(tempWavPath);

      // Clean up temporary files
      try {
        fs.unlinkSync(tempAudioPath);
        fs.unlinkSync(tempWavPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary files:', cleanupError);
      }

      return transcription;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return null;
    }
  }

  private async callAzureSpeechAPI(audioFilePath: string): Promise<string | null> {
    try {
      const audioBuffer = fs.readFileSync(audioFilePath);
      
      const response = await fetch(
        `https://${this.azureSpeechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=pt-BR`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.azureSpeechKey,
            'Content-Type': 'audio/wav',
          },
          body: audioBuffer,
        }
      );

      if (!response.ok) {
        console.error('Azure Speech API error:', await response.text());
        return null;
      }

      const result = await response.json();
      
      if (result.RecognitionStatus === 'Success') {
        return result.DisplayText;
      } else {
        console.error('Speech recognition failed:', result);
        return null;
      }
    } catch (error) {
      console.error('Error calling Azure Speech API:', error);
      return null;
    }
  }

  async handleAudioMessage(audioId: string, from: string): Promise<string> {
    try {
      await this.whatsappClient.sendTypingIndicator(from);
      
      const transcription = await this.transcribeAudio(audioId);
      
      if (!transcription) {
        return "😔 Desculpe, não consegui entender o áudio. Pode tentar novamente ou enviar uma mensagem de texto?";
      }

      return `🎙️ Entendi seu áudio: "${transcription}"`;
    } catch (error) {
      console.error('Error handling audio message:', error);
      return "😔 Ocorreu um erro ao processar seu áudio. Tente novamente.";
    }
  }
}
