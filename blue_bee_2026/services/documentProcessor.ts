
// @google/genai initialization rules followed: use process.env.API_KEY.
import { GoogleGenAI } from "@google/genai";
import { VectorChunk, PdfMetadata } from "../types";
import * as pdfjsLib from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import { parseDocument } from "../utils/documentParser";

const parsePdfDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const raw = dateStr.replace(/^D:/, '');
  if (raw.length >= 8) {
    return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`;
  }
  return dateStr;
};

// Duplicate helper locally to avoid circular dependencies with geminiService
const getApiKey = (): string | undefined => {
    const customKey = localStorage.getItem('DTS_GEMINI_API_KEY');
    if (customKey && customKey.trim().length > 0) return customKey;
    return process.env.API_KEY;
};

export const extractDataFromPDF = async (fileOrUrl: File | string): Promise<{ text: string; metadata: PdfMetadata }> => {
  try {
    let file: File;
    if (typeof fileOrUrl === 'string') {
        const response = await fetch(fileOrUrl);
        const blob = await response.blob();
        file = new File([blob], "downloaded_file");
    } else {
        file = fileOrUrl;
    }

    const text = await parseDocument(file);
    let metadata: PdfMetadata = { title: file.name };

    // Try to get PDF specific metadata if it's a PDF
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: true, isEvalSupported: false });
        const pdf = await loadingTask.promise;
        const meta = await pdf.getMetadata();
        if (meta?.info) {
          const info = meta.info as any;
          metadata = {
            title: info.Title || file.name,
            author: info.Author || '',
            creationDate: parsePdfDate(info.CreationDate),
            producer: info.Producer || ''
          };
        }
      } catch (e) {
        console.warn("Failed to extract PDF metadata, falling back to basic info.");
      }
    }
    
    return { text, metadata };
  } catch (error) {
    console.error("[DOCUMENT-EXTRACT-ERROR]", error);
    throw error;
  }
};

export const extractTextFromPDF = async (file: File): Promise<string> => {
    return await parseDocument(file);
}
