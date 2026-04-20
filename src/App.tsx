/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { 
  FileText, 
  Send, 
  Upload, 
  Trash2, 
  Info, 
  Search, 
  CheckCircle2,
  Database,
  Eraser,
  FileCode,
  FileSpreadsheet,
  File as FileIcon,
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import ReactMarkdown from "react-markdown";
import * as pdfjs from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { cn } from "./lib/utils";

// Initialize PDF.js worker using local Vite URL to avoid CDN fetch issues
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// --- Types ---

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// --- Constants ---

const SYSTEM_INSTRUCTIONS = `
- You are an AI assistant designed to answer questions strictly based on the provided document context.
- Only use the information present in the given context.
- Do not make up an answer or assume anything not in the document.
- If the answer is not found in the document, respond with "The answer is not available in the provided document."
- Always provide concise and accurate answers.
- If numerical data like salary or marks is asked, extract the exact value from the document.
- If multiple answers exist, list all relevant results clearly.
- Maintain clarity and structure in your responses.
`;

// --- AI Service ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Components ---

export default function App() {
  const [context, setContext] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjs.getDocument({ data }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
      setUploadProgress(Math.round((i / pdf.numPages) * 100));
    }
    return fullText;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setUploadStatus("idle");
    setUploadProgress(10);
    setFileError(null);
    
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let extractedText = "";

      if (extension === 'pdf') {
        setUploadProgress(20);
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await extractPdfText(arrayBuffer);
      } else if (extension === 'docx') {
        setUploadProgress(30);
        const arrayBuffer = await file.arrayBuffer();
        setUploadProgress(60);
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
        setUploadProgress(100);
      } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
        setUploadProgress(30);
        const data = await file.arrayBuffer();
        setUploadProgress(50);
        const workbook = XLSX.read(data);
        setUploadProgress(80);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        extractedText = XLSX.utils.sheet_to_csv(worksheet);
        setUploadProgress(100);
      } else {
        setUploadProgress(40);
        extractedText = await file.text();
        setUploadProgress(100);
      }

      setContext(extractedText);
      setUploadStatus("success");
    } catch (error) {
      console.error("File processing error:", error);
      setUploadStatus("error");
      setFileError(`Failed to parse ${file.name}`);
      const systemMessage: Message = {
        id: Date.now().toString(),
        role: "system",
        content: `Error processing ${file.name}. Please ensure the file is not corrupted.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, systemMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'text/plain': ['.txt'], 
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    multiple: false
  });

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!context.trim()) {
      const systemMessage: Message = {
        id: Date.now().toString(),
        role: "system",
        content: "Please provide a document context first to start the Q&A.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, systemMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: `DOCUMENT CONTEXT:\n\n${context}` }] },
          ...messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
          })),
          { role: "user", parts: [{ text: input }] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS,
          temperature: 0.1,
        }
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.text || "The answer is not available in the provided document.",
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: "An error occurred while processing your request. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => setMessages([]);
  const clearContext = () => {
    setContext("");
    setFileName(null);
  };

  return (
    <div className="w-full h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header: Geometric Stability */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white"></div>
          </div>
          <span className="font-bold text-lg tracking-tight uppercase">STRICT-CONTEXT AI</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <span className={cn(
              "w-2 h-2 rounded-full mr-2",
              context ? "bg-green-500" : "bg-slate-300"
            )}></span>
            {context ? `Context Active: ${fileName || 'Pasted Text'}` : "No Context Loaded"}
          </div>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <button 
            onClick={clearChat}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear Session"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Systematic Metadata & Context Management */}
        <aside className="w-80 border-r border-slate-200 bg-white p-6 flex flex-col space-y-8 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Document Analysis</label>
              {context && (
                <button onClick={clearContext} className="text-[10px] font-bold text-indigo-600 uppercase hover:underline">Reset</button>
              )}
            </div>
            <div className="space-y-4">
              <div 
                {...getRootProps()}
                className={cn(
                  "p-3 rounded border transition-all cursor-pointer text-center min-h-[140px] flex flex-col items-center justify-center relative overflow-hidden",
                  isDragActive ? "bg-indigo-50 border-indigo-200 shadow-inner" : "bg-slate-50 border-slate-100 hover:bg-slate-100",
                  uploadStatus === "success" && "border-green-200 bg-green-50",
                  uploadStatus === "error" && "border-red-200 bg-red-50"
                )}
              >
                <input {...getInputProps()} />
                
                {isProcessing ? (
                  <div className="w-full flex flex-col items-center gap-4 z-10">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin absolute" />
                      <span className="text-[10px] font-bold text-indigo-700">{uploadProgress}%</span>
                    </div>
                    <div className="w-4/5 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-indigo-600"
                      />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest animate-pulse">Analyzing Structure</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 z-10">
                    {uploadStatus === "success" ? (
                      <>
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200 mb-1">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-[10px] uppercase text-green-600 font-bold tracking-wider">Upload Complete</div>
                        <div className="text-xs font-medium text-slate-700 truncate w-full px-4 text-center">
                          {fileName}
                        </div>
                      </>
                    ) : uploadStatus === "error" ? (
                      <>
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200 mb-1">
                          <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-[10px] uppercase text-red-600 font-bold tracking-wider">Analysis Failed</div>
                        <div className="text-xs font-medium text-slate-700 px-2 leading-tight">
                          {fileError}
                        </div>
                        <button className="text-[9px] text-indigo-600 font-bold uppercase mt-2 hover:underline">Try Again</button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center mb-1">
                          <Upload className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1 tracking-wider">Source Upload</div>
                        <div className="text-sm font-medium text-slate-700 truncate w-full px-4">
                          {fileName || "PDF, Doc, Excel, CSV..."}
                        </div>
                        {!fileName && <div className="text-[9px] text-slate-400 mt-1 italic">Click or drag to ground AI</div>}
                      </>
                    )}
                  </div>
                )}
              </div>

              {context && (
                <>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded">
                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Character Count</div>
                    <div className="text-sm font-medium italic font-mono">{context.length.toLocaleString()} Chars</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded">
                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Status</div>
                    <div className="text-sm font-medium text-indigo-600 tracking-tight">Strict Compliance Mode</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Manual Input</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Paste context here..."
              className="w-full h-48 p-3 text-xs bg-slate-50 border border-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-mono leading-relaxed"
            />
          </div>

          <div className="bg-indigo-50/50 p-4 rounded border border-indigo-100">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-indigo-600 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-normal italic">
                Geometric Balance active. AI restricted to current analysis window.
              </p>
            </div>
          </div>
        </aside>

        {/* Interaction Area: Precise Layout */}
        <section className="flex-1 flex flex-col p-8 bg-slate-50 relative overflow-hidden">
          {/* Messages History */}
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-sm flex items-center justify-center shadow-sm">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs text-slate-500">Awaiting Inquiry</h3>
                  <p className="text-[10px] font-mono mt-1 italic uppercase tracking-tighter">System Idle / Ready</p>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "px-5 py-3 shadow-sm max-w-[85%]",
                    message.role === "user" 
                      ? "bg-indigo-600 text-white rounded-t-xl rounded-bl-xl shadow-indigo-100" 
                      : message.role === "system"
                      ? "bg-red-50 text-red-600 border border-red-200 rounded-xl px-4 py-2 text-xs"
                      : "bg-white border border-slate-200 text-slate-900 rounded-t-xl rounded-br-xl p-6 w-full prose prose-slate max-w-none"
                  )}>
                    {message.role === "assistant" && (
                      <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
                        <div className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Context Verified Answer</span>
                      </div>
                    )}
                    <div className="text-sm leading-relaxed">
                      {message.role === "assistant" ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-widest px-1">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="bg-white border border-slate-200 p-6 rounded-t-xl rounded-br-xl w-full shadow-sm animate-pulse space-y-4">
                  <div className="h-4 w-48 bg-slate-100 rounded"></div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-50 rounded"></div>
                    <div className="h-3 w-5/6 bg-slate-50 rounded"></div>
                    <div className="h-3 w-4/6 bg-slate-50 rounded"></div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-2 font-mono italic uppercase tracking-widest">Processing Reference Data...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input: Symmetric Footer */}
          <div className="mt-8 shrink-0">
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={context ? "Ask a question based on this document..." : "Provide context to begin..."} 
                disabled={!context || isLoading}
                className="w-full bg-white border border-slate-200 rounded-lg py-4 pl-6 pr-32 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
              <div className="absolute right-3 flex items-center space-x-2">
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading || !context}
                  className="bg-slate-900 text-white px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ask AI
                </button>
              </div>
            </form>
            <p className="text-center text-[10px] text-slate-400 mt-4 italic uppercase tracking-tighter">
              Note: Assistant operates in isolation mode. Zero external hallucination boundary.
            </p>
          </div>
        </section>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E0;
        }
      `}</style>
    </div>
  );
}
