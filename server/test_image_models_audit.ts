import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("CRITICAL: GEMINI_API_KEY is not set in environment.");
  process.exit(1);
}

// Log status without printing any secret characters
console.log(`[Config] GEMINI_API_KEY loaded securely (length: ${apiKey.length}). Secrets are masked.\n`);

const ai = new GoogleGenAI({ apiKey });

interface ModelAuditResult {
  modelId: string;
  inModelList: boolean;
  httpStatus: number | string;
  generationSuccess: boolean;
  receivedImageBytes: boolean;
  byteCount: number;
  mimeType: string;
  textOutput: string;
  supportsEditing: boolean | string;
  editingTested: boolean;
  editingSuccess: boolean;
  quotaBillingError: string | null;
  quotaMetric: string | null;
  estimatedCostPer1K: string;
}

const CANDIDATES = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image (Nano Banana)', cost1K: '$20 - $30 ($0.02 - $0.03/img)' },
  { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Nano Banana 2)', cost1K: '$67 - $151 ($0.067 - $0.151/img)' },
  { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash Lite Image (Nano Banana 2 Lite)', cost1K: '~$33.60 ($0.0336/img)' },
  { id: 'gemini-nano-banana-2.1', name: 'Gemini Nano Banana 2.1', cost1K: '$20 - $30 ($0.02 - $0.03/img)' },
  { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image (Nano Banana Pro)', cost1K: '~$130+ ($0.13+/img)' },
  { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0 Generate 002 (Vertex AI only)', cost1K: '~$40 ($0.04/img on Vertex AI)' },
];

async function runAudit() {
  console.log("=================================================================");
  console.log("   GOOGLE GEMINI IMAGE MODELS AUDIT & COMPATIBILITY TEST         ");
  console.log("=================================================================\n");

  // 1. Fetch available models from API
  console.log("[1/3] Querying ai.models.list() from Google GenAI API...");
  const availableSet = new Set<string>();
  try {
    const list = await ai.models.list();
    for await (const m of list) {
      if (m.name) {
        availableSet.add(m.name.replace(/^models\//, ''));
      }
    }
    console.log(`Found ${availableSet.size} total models in API list.`);
  } catch (err: any) {
    console.warn("Warning: Failed to list models via API:", err.message);
  }

  const results: ModelAuditResult[] = [];

  // 1x1 test PNG
  const smallTestPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  // 2. Test each model one at a time
  console.log("\n[2/3] Testing candidate models one at a time...\n");

  for (const candidate of CANDIDATES) {
    console.log(`-----------------------------------------------------------------`);
    console.log(`Testing Model: ${candidate.id}`);
    const inList = availableSet.has(candidate.id);
    console.log(`Presence in ai.models.list(): ${inList ? 'YES' : 'NO'}`);

    const resRecord: ModelAuditResult = {
      modelId: candidate.id,
      inModelList: inList,
      httpStatus: 'N/A',
      generationSuccess: false,
      receivedImageBytes: false,
      byteCount: 0,
      mimeType: 'N/A',
      textOutput: '',
      supportsEditing: 'Yes (official)',
      editingTested: false,
      editingSuccess: false,
      quotaBillingError: null,
      quotaMetric: null,
      estimatedCostPer1K: candidate.cost1K
    };

    // --- Image Generation Test ---
    if (candidate.id.startsWith('imagen-')) {
      // Test Imagen with generateImages
      resRecord.supportsEditing = 'No (generate only)';
      try {
        const genRes = await ai.models.generateImages({
          model: candidate.id,
          prompt: 'red dot',
          config: { numberOfImages: 1 }
        });
        resRecord.httpStatus = 200;
        const bytes = genRes?.generatedImages?.[0]?.image?.imageBytes;
        if (bytes && bytes.length > 0) {
          resRecord.generationSuccess = true;
          resRecord.receivedImageBytes = true;
          resRecord.byteCount = Buffer.from(bytes, 'base64').length;
          resRecord.mimeType = 'image/jpeg';
        }
      } catch (e: any) {
        resRecord.httpStatus = e.status || e.statusCode || 'ERROR';
        resRecord.quotaBillingError = e.message?.slice(0, 160) || 'Unknown error';
        if (e.message?.includes('Vertex AI') || e.message?.includes('Gemini Enterprise')) {
          resRecord.quotaBillingError = 'Vertex AI / Gemini Enterprise only (unsupported on Google AI Studio API key)';
        }
      }
    } else {
      // Test Gemini image models with generateContent
      try {
        const genRes = await ai.models.generateContent({
          model: candidate.id,
          contents: "red dot",
          config: {
            responseModalities: ["IMAGE", "TEXT"]
          }
        });

        resRecord.httpStatus = 200;
        const parts = genRes?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if ((p as any).inlineData?.data) {
            resRecord.generationSuccess = true;
            resRecord.receivedImageBytes = true;
            resRecord.mimeType = (p as any).inlineData.mimeType || 'image/png';
            resRecord.byteCount = Buffer.from((p as any).inlineData.data, 'base64').length;
          } else if (p.text) {
            resRecord.textOutput = p.text.trim();
          }
        }
      } catch (e: any) {
        resRecord.httpStatus = e.status || e.statusCode || (e.message?.includes('429') ? 429 : 'ERROR');
        
        // Parse quota / billing details
        if (e.status === 429 || e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
          const isLimitZero = e.message?.includes('limit: 0');
          resRecord.quotaBillingError = isLimitZero
            ? '429 RESOURCE_EXHAUSTED (Quota limit: 0 on Free Tier — Requires Paid Billing Tier)'
            : '429 RESOURCE_EXHAUSTED (Rate limit or daily quota reached)';
          
          if (e.errorDetails) {
            for (const d of e.errorDetails) {
              if (d.violations) {
                resRecord.quotaMetric = d.violations.map((v: any) => v.quotaMetric).join(', ');
              }
            }
          }
        } else {
          resRecord.quotaBillingError = e.message?.slice(0, 160) || 'Unknown error';
        }
      }

      // --- Image Editing Test (Only if not already blocked by quota to adhere to rule 8) ---
      if (resRecord.generationSuccess) {
        resRecord.editingTested = true;
        try {
          console.log(`  Testing editing on ${candidate.id}...`);
          const editRes = await ai.models.generateContent({
            model: candidate.id,
            contents: [
              { inlineData: { data: smallTestPng, mimeType: 'image/png' } },
              { text: "Change the color to blue" }
            ],
            config: { responseModalities: ["IMAGE", "TEXT"] }
          });
          const editParts = editRes?.candidates?.[0]?.content?.parts || [];
          for (const p of editParts) {
            if ((p as any).inlineData?.data) {
              resRecord.editingSuccess = true;
            }
          }
        } catch (editErr: any) {
          console.log(`  Editing test failed:`, editErr.message);
        }
      } else {
        // If generation failed due to quota/billing, editing shares the same model and quota,
        // so we do not make repeated failing requests per rule 8.
        console.log(`  Skipping repeated edit call to avoid quota abuse per rule 8.`);
      }
    }

    console.log(`Result: HTTP ${resRecord.httpStatus}`);
    console.log(`Generation Success: ${resRecord.generationSuccess ? 'YES' : 'NO'}`);
    console.log(`Valid Image Bytes: ${resRecord.receivedImageBytes ? `YES (${resRecord.byteCount} bytes)` : 'NO'}`);
    if (resRecord.quotaBillingError) {
      console.log(`Blocker / Error: ${resRecord.quotaBillingError}`);
    }

    results.push(resRecord);
  }

  console.log("\n=================================================================");
  console.log("                       AUDIT SUMMARY TABLE                       ");
  console.log("=================================================================\n");

  console.table(results.map(r => ({
    'Model ID': r.modelId,
    'In API List': r.inModelList ? 'Yes' : 'No',
    'HTTP Status': r.httpStatus,
    'Gen Success': r.generationSuccess ? 'YES' : 'NO',
    'Image Bytes': r.receivedImageBytes ? `${r.byteCount}B` : '0B',
    'MIME Type': r.mimeType,
    'Editing Support': r.supportsEditing,
    'Estimated Cost / 1K': r.estimatedCostPer1K,
    'Blocker / Note': r.quotaBillingError || 'Working'
  })));
}

runAudit().catch(console.error);
