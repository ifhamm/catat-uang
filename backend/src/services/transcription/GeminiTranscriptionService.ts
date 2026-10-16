import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { TranscriptionService, TranscriptionResult } from './types';

export class GeminiTranscriptionService implements TranscriptionService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const startTime = Date.now();

    // Clean mimeType (remove parameters like ';codecs=opus' which can cause 400 errors)
    const cleanMimeType = (mimeType ? mimeType.split(';')[0]?.trim() : '') || 'audio/webm';

    const inlineData: Part = {
      inlineData: {
        data: audioBuffer.toString("base64"),
        mimeType: cleanMimeType
      }
    };

    const prompt = `
Anda adalah asisten pencatat keuangan (Catat Uang).
Transkripsikan audio bahasa Indonesia berikut ini secara akurat.
Perhatikan dengan saksama pelafalan yang mungkin kurang jelas (seperti huruf R dan L) sesuai konteks kalimat.
Jika ada ralat/koreksi eksplisit di dalam ucapan (misal "seratus eh lima belas ribu" atau "bukan lima puluh, lima belas ribu"), tangkap maksud akhir pengguna.
Ekstrak nominal uangnya sebagai angka bulat positif (contoh: 15000) jika ada.

Kembalikan hasil HANYA dalam format JSON dengan skema berikut:
{
  "text": "Teks lengkap ucapan.",
  "nominal": 15000,
  "notes": "Komentar singkat analisis pelafalan atau koreksi, jika ada."
}
Pastikan tidak ada markdown (seperti \`\`\`json) atau teks lain, cukup kembalikan teks JSON murni.
`;

    // Candidate models to try in order of preference
    const preferredModel = process.env.GEMINI_MODEL;
    const defaultCandidates = [
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ];

    const candidateModels = Array.from(
      new Set(preferredModel ? [preferredModel, ...defaultCandidates] : defaultCandidates)
    );

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json'
          }
        });

        const result = await model.generateContent([prompt, inlineData]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown block if model adds it
        const jsonString = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        let parsed;
        try {
          parsed = JSON.parse(jsonString);
        } catch (e) {
          console.error(`Failed to parse Gemini output from ${modelName}:`, jsonString);
          throw new Error('Invalid JSON output from Gemini');
        }

        const processingTimeMs = Date.now() - startTime;

        return {
          text: parsed.text || '',
          processingTimeMs,
          detectedNominal: parsed.nominal,
          notes: parsed.notes,
          isMock: false
        };
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini model "${modelName}" failed (${error?.status || error?.message || 'unknown error'}). Trying next candidate...`);
      }
    }

    console.error('All Gemini candidate models failed:', lastError);
    throw lastError;
  }
}
