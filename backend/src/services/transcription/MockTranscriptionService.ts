import { TranscriptionService, TranscriptionResult } from './types';

export class MockTranscriptionService implements TranscriptionService {
  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // Simulate API delay (1.5 - 2.5 seconds)
    const delay = Math.floor(Math.random() * 1000) + 1500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const processingTimeMs = Date.now() - startTime;
    
    // Determine output based on audio size or randomized logic
    // For this spike, we can use a randomized output that includes the test cases
    const scenarios = [
      { text: "makan lima belas ribu", nominal: 15000, notes: "Uji: lima belas vs lima puluh" },
      { text: "makan lima puluh ribu", nominal: 50000, notes: "Uji: lima belas vs lima puluh" },
      { text: "kemarin bensin tiga puluh ribu", nominal: 30000, notes: "Uji nominal standar" },
      { text: "gaji lima juta", nominal: 5000000, notes: "Uji nominal besar" }
    ];
    
    // Pick a scenario based on buffer length to be somewhat deterministic for testing
    // Or just pick randomly
    const index = audioBuffer.length % scenarios.length;
    const scenario = scenarios[index];
    if (!scenario) {
      throw new Error('No mock transcription scenario configured');
    }
    
    return {
      text: scenario.text,
      processingTimeMs,
      detectedNominal: scenario.nominal,
      notes: scenario.notes,
      isMock: true
    };
  }
}
