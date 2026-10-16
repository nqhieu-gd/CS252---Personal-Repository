# Week 1 - Exercise 5: Responsible AI Usage

**Student**: Nguyen Quang Hieu - 25125043 

---

## 1. Have you used AI before?

Yes. I actually utilize AI a lot as a personal assistant. I try to solve problems by myself, but when I need to research something new or do a repetitive work, AI becomes my handy partner, not only AI boosts my efficiency, I also have spare time to check my work and work on the next projects/assignments. My AI usage includex, but not limited to:

### 1.1 Code Debugging & Refactoring
In software development labs and programming projects, debugging can often consume a significant amount of time due to obscure error messages or subtle logic bugs. My workflow with AI for debugging includes:

* **Error Trace Diagnostics:** When encountering complex stack traces or compilation errors (e.g., memory leaks, segment faults, or syntax mismatches), I feed the error logs along with relevant code snippets to AI to understand *why* the error occurred.
* **Logic & Edge Case Auditing:** I ask AI to review my algorithms for boundary conditions or unhandled edge cases (e.g., null pointers, array index overflows) that I might have overlooked.
* **Code Explanation:** When learning unfamiliar libraries or framework APIs, I use AI to explain specific functions line-by-line before implementing them myself.

### 1.2 Academic Studying & Concept Mastery
AI has transformed the way I study and absorb dense technical material:

* **Socratic Dialogue & Interactive Tutoring:** Instead of asking for direct answers to study questions, I prompt AI to act as a professor: *"Explain this concept step-by-step, then ask me a follow-up question to test my understanding."*
* **Simplifying Abstract Concepts:** When encountering challenging mathematical formulas or hardware architecture concepts, I ask AI to provide intuitive real-world analogies before diving back into formal textbooks.
* **Self-Quiz Generation:** Prior to exams, I provide my notes or topics to AI and request a set of conceptual practice questions and code snippets to evaluate my mastery.

### 1.3 Researching & Material Synthesis
For research tasks and reading academic literature:

* **Paper Summarization:** When reviewing lengthy research papers, I ask AI for a high-level summary of the methodology, key findings, and limitations to quickly determine relevance.
* **Search Strategy:** I use AI to brainstorm search keywords and identify related topics or foundational papers in a specific research domain.
* **Structuring Drafts:** I use AI to help brainstorm outlines and logical structures for technical reports before I begin writing the actual content.

---

## 2. Do you have any experience or tips for using AI?

Based on my hands-on experience and reference materials on **Responsible AI** (including the VNPT AI core principles), I follow a strict personal code of ethics when using AI:

### Tip 1: Always Keep "Human-in-the-Loop" and Take Full Responsibility for AI Outputs (Verification Over Blind Trust)
AI models frequently hallucinate facts, invent non-existent library functions, or generate flawed code. 
* **My Practice:** I verify every piece of code by running and testing it in my local environment. For academic claims or citations, I cross-check references against primary databases like IEEE Xplore, Google Scholar, or official documentation.

### Tip 2: Practice Effective Prompting (Context & Constraints)
Vague prompts lead to generic or unhelpful answers. 
* **My Practice:** I structure my prompts with clear roles, context, and constraints.
  * *Example Prompt:* *"Act as a C++ tutor. Review my sorting function for memory efficiency. Do not rewrite the code for me; instead, point out where unnecessary memory allocations are happening and ask me a guiding question."*

### Tip 3: Safeguard Data Privacy and Security
Following responsible AI guidelines regarding security and confidentiality:
* **My Practice:** I never upload sensitive personal data, private API keys, passwords, or confidential institutional files to public AI chatbots. I sanitize code snippets before sharing them with an LLM.