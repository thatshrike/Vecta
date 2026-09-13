# Vecta - Compliance Verification Workspace

Vecta is an automated, AI-powered evaluation pipeline for Government e-Marketplace (GeM) tender bids. It accelerates public procurement by automatically ingesting, verifying, and scoring bidder compliance against complex technical and statutory tender requirements.

## 🎯 Scope
Vecta streamlines the public procurement lifecycle by replacing manual, error-prone dossier scanning with an intelligent ingestion pipeline. It acts as a force multiplier for procurement officers—parsing hundreds of pages of technical specifications, statutory declarations, and company profiles in seconds to generate a unified compliance matrix.

## 🏗️ Architecture

Vecta is built on a decoupled, modern technology stack:

- **Frontend (React + Vite + TailwindCSS)**
  A responsive, single-page application that provides a unified dashboard for officers. It handles parallel file uploads, visualizes bidder dossiers, renders a side-by-side comparative matrix, and provides a strict "Human-in-the-Loop" interface for overriding verdicts.
  
- **Backend (Python + FastAPI)**
  A high-throughput API server that manages document orchestration, chunking, and AI integration.
  
- **Ingestion & Extraction Engine**
  Uses `PyMuPDF` for high-fidelity, layout-aware PDF text extraction, coupled with OCR fallback for scanned or image-based submissions.
  
- **Evaluation Core (Hybrid NLP + LLM)**
  Combines deterministic heuristics (Regex, multi-line pattern matching, spatial table analysis) for rigid requirements with Google's Gemini 2.5 Flash API for nuanced, semantic clause evaluations.
  
- **Verification Adapters (L3)**
  Simulated and real-time adapters that validate the authenticity of extracted identifiers like PAN, GSTIN, and Udyam Registration numbers.

## ⚡ Capabilities

1. **Automated Technical Specification Matching**
   Intelligently identifies and extracts Bill of Quantities (BoQ) and technical specification tables from bidder documents, comparing offered parameters against required thresholds.
   
2. **Semantic Clause Evaluation**
   Leverages Large Language Models to interpret complex, narrative claims (e.g., *"Must have 5 years of experience in supplying defense-grade equipment"*) and determine compliance based on the bidder's text.
   
3. **Statutory Policy Verification**
   Automatically identifies and validates mandatory government policies, such as Make in India (MII) local content declarations and MSME/Udyam exemptions.
   
4. **Automated ID Extraction & Verification**
   Extracts PAN and GSTIN numbers from bids, executing checksum algorithms and format validations to flag fake or malformed identities.
   
5. **Human-in-the-Loop Override & Auditing**
   While Vecta does the heavy lifting, the procurement officer always retains final authority. Officers can override AI verdicts with a required reason, which is permanently logged in a tamper-proof audit trail (`audit_log.jsonl`).
   
6. **Comparison Matrix Export**
   Automatically generates a comprehensive, side-by-side CSV matrix mapping every clause against every bidder for transparent, defensible decision-making.

## 🚀 Unique Selling Proposition (USP)

- **Deterministic-First Strategy**
  Unlike naive "chat-with-pdf" wrappers, Vecta prioritizes robust, zero-hallucination regex and spatial parsing for exact requirements. It only falls back to AI for semantic tasks, guaranteeing high performance, low costs, and minimal API rate-limiting.
  
- **Fully Defensible & Transparent**
  Vecta is built for government accountability. Every AI verdict highlights the exact evidence used, and every human override is logged. There are no "black box" rejections.
  
- **GeM Tailored Intelligence**
  Specifically designed around the realities of Indian Government procurement, with built-in understanding of local content percentages, MSE exemptions, statutory formatting, and standard defense/PSU BOQ structures.
