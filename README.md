# 📄 Contextual AI Q&A (RAG-based Document Assistant)

A modern **Retrieval-Augmented Generation (RAG)** web application that allows users to upload documents (PDF, DOCX, XLSX, etc.) and ask contextual questions. The system extracts content from files and uses AI to provide accurate, document-based answers.

---

## 🚀 Features

- 📂 Upload multiple file formats:
  - PDF
  - DOCX
  - XLSX
- 🤖 AI-powered contextual Q&A
- 📌 Answers strictly based on uploaded documents
- ⚡ Fast processing using modern frontend stack
- 🎯 Clean UI with drag-and-drop support
- 🧠 Uses Google GenAI for intelligent responses

---

## 🛠️ Tech Stack

**Frontend:**
- React (TypeScript)
- Vite
- Tailwind CSS
- Lucide Icons
- Framer Motion

**Backend / Processing:**
- Node.js + Express
- Google Generative AI (`@google/genai`)

**File Processing Libraries:**
- pdfjs-dist (PDF parsing)
- mammoth (DOCX extraction)
- xlsx (Excel parsing)

---

## 📁 Project Structure

```
contextual-ai-qna/
│
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── lib/
│       └── utils.ts
│
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── .gitignore
```

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-username/contextual-ai-qna.git
cd contextual-ai-qna
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file:

```env
GOOGLE_API_KEY=your_api_key_here
```

### 4. Run the development server
```bash
npm run dev
```

App will run at:
```
http://localhost:3000
```

---

## 🧠 How It Works

1. User uploads document(s)
2. Content is extracted using parsing libraries
3. Text is processed and sent to AI model
4. User asks a question
5. System retrieves relevant context from document
6. AI generates accurate, contextual answer

---

## 📌 Use Cases

- 📚 Study assistant (notes, PDFs, textbooks)
- 🏢 Business document analysis
- 📊 Data extraction from Excel reports
- 📄 Legal/technical document querying
- 🎓 Academic research helper

---

## ⚠️ Limitations

- Accuracy depends on document quality
- Large files may slow processing
- No long-term memory (session-based)

---

## 🔮 Future Improvements

- Vector database integration (FAISS / Pinecone)
- Chunking + embeddings for better retrieval
- Multi-document comparison
- Chat history memory
- Authentication & user dashboard
- Deployment (Vercel / AWS)

---

## 🧑‍💻 Author

**Krish Garg**  
B.Tech Student | AI & Full Stack Enthusiast

---

## ⭐ Contribution

Feel free to fork this repo and improve it. Pull requests are welcome.

---

## 📜 License

This project is licensed under the MIT License.
