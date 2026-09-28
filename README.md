# 🎤 Smart Interview Analyzer - Frontend

A modern web interface for the **Smart Interview Analyzer Using AI** project.

The application allows users to practice interview questions, record their answers using a webcam/microphone, send the recorded interview to the AI backend for analysis, and view detailed interview performance results.

---

## 🚀 Project Overview

The Smart Interview Analyzer is an AI-based mock interview system designed to help students and job seekers practice interviews.

The frontend provides the user interface for:

- Selecting interview questions
- Starting an interview
- Recording video and audio responses
- Uploading recorded responses for analysis
- Displaying AI-generated interview feedback
- Viewing scores and emotion analysis
- Viewing transcripts and fluency results
- Maintaining interview history

The frontend communicates with the Smart Interview Analyzer backend through a REST API.

---

## ✨ Features

### 🏠 Dashboard
- Clean and modern interview dashboard
- Start a new interview
- View previous interview sessions

### 💼 HR / Behavioral Interview
Sample questions include:

- Tell me about yourself
- Why should we hire you?
- Tell me about a difficult situation you handled
- How do you work under pressure?
- What are your strengths?
- Tell me about a mistake you made
- Where do you see yourself in five years?
- Why do you want to join our company?

### 🎥 Interview Recording
- Webcam-based video recording
- Microphone audio recording
- Recorded response preview
- Upload recorded interview response for AI analysis

### 🤖 AI Analysis Results

The frontend displays results received from the backend for:

- Video emotion analysis
- Audio emotion analysis
- Answer quality
- Fluency
- Interview transcript
- Overall score and grade

### 📊 Performance Dashboard

The results page displays:

- Overall score
- Grade
- Text answer quality
- Audio emotion
- Video emotion
- Fluency
- Transcript
- Analysis details

### 🕒 Interview History

Previous interview results can be stored locally in the browser and viewed later.

---

## 🛠️ Tech Stack

- React
- TypeScript
- Vite
- HTML5
- CSS3
- JavaScript
- Browser MediaRecorder API
- REST API

---

## 📁 Project Structure

```text
smart-interview-frontend/
│
├── public/
│
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── ...
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── script.js
├── style.css
├── .env.example
└── README.md
