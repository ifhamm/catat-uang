export interface TranscriptionResult {
  text: string;
  processingTimeMs: number;
  detectedNominal?: number;
  notes?: string;
  isMock: boolean;
}

export interface TranscriptionService {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult>;
}
