# Resume Scorer - AI-Powered Resume Analysis

## Overview

![alt text](https://github.com/tpaidich/resume-scorer/blob/main/resume%20scorer%20dashboard.png)

A web application designed to help you understand how well your resume aligns with a specific job description. The tool provides a comprehensive fit score, highlights key matching areas, identifies missing skills, and suggests relevant projects and keywords. Front-end created in TypeScript using Lovable.dev.

## Features

-   Resume PDF Upload: Upload your resume in PDF format.
-   Job Description Input: Paste the job description you want to match against.
-   Get an immediate fit score and detailed insights.
    -   Overall Fit Score
    -   General Insights (overall summary)
    -   Matched skills and missing skills
    -   Parts of your resume to highlight
    -   Project suggestions to fill skill gaps
-   Dark Mode Toggle - For comfortable viewing in different lighting conditions.
-   Report Download - Download a text report of the analysis.

## Scoring Logic Explained

The fit score is calculated as a composite score, blending two main factors: **Overall Textual Similarity (TF-IDF)** and **Skill Match Ratio**.

### 1. Overall Textual Similarity (Base Fit Score)

-   Method: Term Frequency-Inverse Document Frequency (TF-IDF) and Cosine Similarity.
-   How it works:
    1.  Both the job description and your resume text are cleaned and tokenized (converted into individual words/phrases, removing common stop words and short terms).
    2.  Term frequencies are calculated for each document (how often a word appears).
    3.  Cosine similarity then measures the "angle" between the two documents' word vectors. A smaller angle (closer to 100%) indicates higher overall textual similarity.
-   Contribution to Final Score: This `baseFitScore` accounts for **15%** of the `adjustedFitScore`. It reflects how semantically similar the overall content of your resume is to the job description, beyond just specific skills.

### 2. Skill Match Ratio

-   Method: Direct comparison of extracted skills.
-   How it works:
    1.  The application uses a predefined list of common technical and soft skills (e.g., "JavaScript", "Python", "Leadership", "Project Management").
    2.  It identifies which of these skills are present in the job description (`jobSkills`) and which are present in your resume (`resumeSkills`).
    3.  `matchedSkills` are then determined by finding the intersection of `jobSkills` and `resumeSkills`.
    4.  The `skillMatchRatio` is calculated as `matchedSkills.length / jobSkills.length`.
-   Contribution to Final Score: This `skillMatchRatio` accounts for **85%** of the `adjustedFitScore`. This high weighting emphasizes the importance of direct skill alignment between your resume and the job requirements.

### Final Adjusted Fit Score

The `adjustedFitScore` is calculated using the following formula:

```
adjustedFitScore = (baseFitScore * 0.15) + (skillMatchRatio * 100 * 0.85)
```

-   The score is then capped at 100% and rounded to the nearest whole number to produce the `finalFitScore`.
-   If no skills are extracted from the job description, the `skillMatchRatio` component contributes 0, and the score is solely based on the `baseFitScore`.

## How the AI (LLM) Contributes

The application makes a single consolidated API call to the Google Gemini 1.5 Flash model to generate comprehensive insights. The LLM is given the job description, resume text, initially identified missing skills, and the calculated fit score. Based on this, it provides:

-   General Insight: A concise paragraph summarizing the overall fit, highlighting strengths and major gaps.
-   Ranked Missing Skills: A list of skills from the job description that are not present in your resume, ranked by their inferred importance. The LLM is instructed to infer skills that are implied by your experience, even if not explicitly stated.
-   Areas to Highlight: Specific sections, keywords, experiences, or projects from your resume that are most relevant to the job description and should be emphasized.
-   Project Suggestions: Concise project ideas to help you demonstrate proficiency in identified missing skill areas. These are provided as a numbered list for clarity.
-   LLM-Generated Matched Skills: A refined list of important technical and soft skills that appear in *both* the job description and resume, with the LLM inferring skills from descriptive text (e.g., inferring "Leadership" from "Project Manager" roles). This list is for display purposes, while the rule-based `matchedSkills` are used for the numerical scoring.

## Getting Started

To run this project locally:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/tpaidich/resume-scorer.git
    cd resume-scorer
    ```
2.  **Install dependencies:**
    ```bash
    # npm install
    ```
3.  **Configure API Key:**
    -   Obtain a Google Gemini API Key from the Google AI Studio.
    -   Create a `.env` file in the project root.
    -   Add your API key to the `.env` file
      
4.  **Run the development server:**
    ```bash
    # npm run dev
    ```
5.  Open your browser to the address provided.

---

