import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// TODO: Replace with your actual Gemini API key, ideally from an environment variable
// For example, if using Vite, you might define it in .env and access via import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=';

// Utility function to introduce a delay
let delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Generic retry mechanism with exponential backoff
async function retryWithExponentialBackoff<T>(fn: () => Promise<T>, retries = 5, initialDelay = 1000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt < retries && (error.message.includes('429') || error.message.includes('503') || error.message.includes('ECONNRESET'))) {
        const delayTime = initialDelay * Math.pow(2, attempt) + Math.random() * 1000; // Exponential backoff with jitter
        console.warn(`Retrying after error: ${error.message}. Attempt ${attempt + 1}/${retries}. Waiting ${delayTime}ms.`);
        await delay(delayTime);
        attempt++;
      } else {
        throw error;
      }
    }
  }
}

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface AnalysisResult {
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  insights: string[];
  // topKeywords: { word: string; score: number }[]; // Removed as per new design
  fitMessage: string;
  highlightAreas: string[]; // New field for LLM-generated highlight areas
  projectSuggestions: string[]; // New field for LLM-generated project suggestions
  resumeKeywords: string[]; // New field for LLM-generated resume keywords
  linkedinJobLinks: string[]; // New field for LinkedIn job links
}

interface CombinedAnalysisOutput {
  generalInsight: string;
  rankedMissingSkills: string[];
  highlightAreas: string[];
  projectSuggestions: string[];
  matchedSkills: string[]; // New field for LLM-generated matched skills
  resumeKeywords: string[]; // New field for LLM-generated resume keywords
}

// Common technical skills and keywords
const commonSkills = [
  'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'C++', 'C#',
  'HTML', 'CSS', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'Git', 'Linux', 'Agile', 'Scrum', 'DevOps', 'CI/CD', 'REST', 'GraphQL',
  'Machine Learning', 'AI', 'Data Science', 'Analytics', 'Project Management', 'Leadership',
  'Communication', 'Problem Solving', 'Teamwork', 'Strategic Planning', 'Marketing', 'Sales',
  'Customer Service', 'Design', 'UX', 'UI', 'Figma', 'Photoshop', 'Illustrator'
];

// Additional technical keywords that might not be skills but are important
const technicalKeywords = [
  'frontend', 'backend', 'fullstack', 'devops', 'cloud', 'database', 'api', 'web', 'mobile',
  'algorithm', 'data structure', 'architecture', 'system design', 'testing', 'deployment',
  'security', 'networking', 'virtualization', 'containerization', 'scripting', 'automation',
  'framework', 'library', 'restful', 'microservices', 'scalable', 'performance',
  'optimization', 'analytics', 'visualization', 'big data', 'real-time', 'distributed systems'
];

// Common English stop words
const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 'may','no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with'
]);

// Extract text from PDF file
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + ' ';
  }
  
  return fullText;
}

// Clean and tokenize text (browser-compatible implementation)
function cleanAndTokenize(text: string): string[] {
  // Convert to lowercase and remove special characters, keeping only letters and numbers
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  // Split by whitespace, filter out empty strings, short words, and stop words
  return cleaned.split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));
}

// Extract skills from text
function extractSkills(text: string): string[] {
  const words = text.toLowerCase();
  return commonSkills.filter(skill => 
    words.includes(skill.toLowerCase())
  );
}

// Calculate TF-IDF similarity (custom implementation)
function calculateTFIDFSimilarity(text1: string, text2: string): number {
  const tokens1 = cleanAndTokenize(text1);
  const tokens2 = cleanAndTokenize(text2);
  console.log("Debug TFIDF: Tokens 1 (Job Description)", tokens1);
  console.log("Debug TFIDF: Tokens 2 (Resume Text)", tokens2);
  
  // Calculate term frequencies
  const tf1 = calculateTermFrequency(tokens1);
  const tf2 = calculateTermFrequency(tokens2);
  console.log("Debug TFIDF: Term Frequencies 1 (Job Description)", tf1);
  console.log("Debug TFIDF: Term Frequencies 2 (Resume Text)", tf2);
  
  // Get all unique terms
  const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  
  // Calculate cosine similarity
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allTerms.forEach(term => {
    const freq1 = tf1[term] || 0;
    const freq2 = tf2[term] || 0;
    
    dotProduct += freq1 * freq2;
    magnitude1 += freq1 * freq1;
    magnitude2 += freq2 * freq2;
  });
  
  const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  if (magnitude === 0) return 0;
  
  return (dotProduct / magnitude) * 100;
}

// Calculate term frequency
function calculateTermFrequency(tokens: string[]): { [key: string]: number } {
  const tf: { [key: string]: number } = {};
  const totalTokens = tokens.length;
  
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  
  // Normalize by total tokens
  Object.keys(tf).forEach(term => {
    tf[term] = tf[term] / totalTokens;
  });
  
  return tf;
}

// Consolidate all LLM calls into a single function
async function getCombinedInsightsWithGemini(
  jobDescription: string,
  resumeText: string,
  missingSkills: string[],
  fitScore: number
): Promise<CombinedAnalysisOutput | null> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("Gemini API key is not configured. Skipping combined LLM insights.");
    return null;
  }

  const prompt = `You are a resume analysis AI. Given a job description, a resume, a list of missing skills from the resume for the job, and a fit score (out of 100), provide a comprehensive analysis.

Your response MUST be a single JSON object with the following structure:
{
  "generalInsight": "A concise paragraph (3-5 sentences) summarizing the overall fit, highlighting strengths and major gaps based on the fit score. Tailor it to be encouraging yet realistic. For example, 'The candidate presents a strong foundational match with a score of X, particularly excelling in Y and Z. To further enhance their profile, focusing on A and B would be highly beneficial.'",
  "rankedMissingSkills": ["Skill A", "Skill B", "Skill C"], // List of missing skills from most to least important for the job, based on the job description.
  "highlightAreas": ["Area 1", "Area 2"], // 5-7 specific areas/sections/keywords/experiences from the resume that are most relevant to the job description and should be highlighted. Provide concrete examples.
  "projectSuggestions": ["Project A: Description A.", "Project B: Description B."], // 3-5 concise project ideas (1-2 sentences each) that demonstrate proficiency in the missing skills.
  "matchedSkills": ["Skill X", "Skill Y", "Skill Z"], // 5-10 most important technical skills, tools, and keywords that appear in BOTH the job description and resume, focusing on relevance.
  "resumeKeywords": ["Keyword1", "Keyword2"] // 5-10 highly relevant keywords and phrases from the resume that best represent the candidate's core profile and expertise. Use these for job searching.
}

Strictly follow the JSON format and do not include any other text outside the JSON object.

Job Description:\n${jobDescription}\n
Resume Text:\n${resumeText}

Missing Skills (from resume for this job):\n${missingSkills.length > 0 ? missingSkills.join(', ') : 'None'}

Fit Score: ${fitScore}/100`;

  try {
    const response = await retryWithExponentialBackoff(async () => {
      return await fetch(`${GEMINI_API_URL}${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }),
      });
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0]?.content?.parts[0]?.text;

    if (textResponse) {
      const cleanedResponse = textResponse.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedResponse) as CombinedAnalysisOutput;
    }
    return null;

  } catch (error) {
    console.error("Error calling Gemini API for combined insights:", error);
    throw error; // Re-throw to be caught by analyzeFit
  }
}

const GOOGLE_CSE_CX = '20f909c31d0bf488d'; // Your Custom Search Engine ID

async function getLinkedInJobLinks(keywords: string[]): Promise<string[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Using VITE_GEMINI_API_KEY for Google Custom Search API as per user's setup
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("Google Custom Search API key is not configured. Skipping LinkedIn job search.");
    return [];
  }

  const searchQuery = `site:linkedin.com/jobs/ ${keywords.join(' ')}`;
  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(searchQuery)}&num=10`;

  try {
    const response = await retryWithExponentialBackoff(async () => {
      return await fetch(apiUrl);
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Custom Search API error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    const jobLinks: string[] = [];

    if (data.items) {
      for (const item of data.items) {
        if (item.link && item.link.includes('linkedin.com/jobs')) {
          jobLinks.push(item.link);
        }
      }
    }
    return jobLinks;

  } catch (error) {
    console.error("Error fetching LinkedIn job links:", error);
    return [];
  }
}

export async function analyzeFit(jobDescription: string, resumeFile: File, onProgress?: (stage: string) => void): Promise<AnalysisResult> {
  try {
    onProgress?.("Extracting text from PDF...");
    // Extract text from PDF
    const resumeText = await extractTextFromPDF(resumeFile);
    await delay(500); // Add a small delay after PDF extraction
    
    onProgress?.("Calculating fit score...");
    // Calculate base similarity score using TF-IDF
    const baseFitScore = calculateTFIDFSimilarity(jobDescription, resumeText);
    console.log(`Debug: Job Description (raw): ${jobDescription.substring(0, 200)}...`);
    console.log(`Debug: Resume Text (raw, partial): ${resumeText.substring(0, 200)}...`);
    
    // Extract skills from both texts
    const jobSkills = extractSkills(jobDescription);
    console.log("Debug: Extracted Job Skills:", jobSkills);
    const resumeSkills = extractSkills(resumeText);
    
    // Calculate skill-based adjustments
    const matchedSkills = resumeSkills.filter(skill => jobSkills.includes(skill));
    const missingSkills = jobSkills.filter(skill => !resumeSkills.includes(skill));

    console.log(`Debug: baseFitScore: ${baseFitScore}`);
    console.log(`Debug: matchedSkills.length: ${matchedSkills.length}`);
    console.log(`Debug: jobSkills.length: ${jobSkills.length}`);
    
    // Adjust fit score based on skill matching
    let adjustedFitScore = baseFitScore;
    if (jobSkills.length > 0) {
      const skillMatchRatio = matchedSkills.length / jobSkills.length;
      console.log(`Debug: Skill Match Ratio: ${skillMatchRatio}`);
      adjustedFitScore = (baseFitScore * 0.3) + (skillMatchRatio * 100 * 0.7); // Changed weights to 0.7 and 0.3
    } else { // If no job skills are extracted, skill match contributes 0
      adjustedFitScore = baseFitScore * 0.3; // Only base score contributes
    }
    console.log(`Debug: Adjusted Fit Score (before final rounding): ${adjustedFitScore}`);
    
    // Cap the score at 100 and ensure minimum of 0
    const finalFitScore = Math.min(100, Math.max(0, Math.round(adjustedFitScore)));
    
    onProgress?.("Generating insights and ranking skills...");
    // Generate insights
    const combinedInsights = await getCombinedInsightsWithGemini(
      jobDescription, 
      resumeText, 
      missingSkills, // Use rule-based missing skills for LLM input
      finalFitScore
    );
    await delay(500); // Add a small delay after generateInsights

    const insights = combinedInsights?.generalInsight ? [combinedInsights.generalInsight] : [];
    const rankedMissingSkills = combinedInsights?.rankedMissingSkills || [];
    const highlightAreas = combinedInsights?.highlightAreas || [];
    const projectSuggestions = combinedInsights?.projectSuggestions || [];
    const llmMatchedSkills = combinedInsights?.matchedSkills || [];
    const resumeKeywords = combinedInsights?.resumeKeywords || [];

    onProgress?.("Searching for LinkedIn job listings...");
    const linkedinJobLinks = await getLinkedInJobLinks(resumeKeywords);
    await delay(500); // Add a small delay after searching for job links

    return {
      fitScore: finalFitScore,
      matchedSkills: llmMatchedSkills, // Use LLM-generated matched skills for output
      missingSkills: rankedMissingSkills, // Use LLM-ranked missing skills for output
      insights,
      fitMessage: combinedInsights?.generalInsight || '',
      highlightAreas,
      projectSuggestions,
      resumeKeywords,
      linkedinJobLinks // Include LinkedIn job links in the result
    };
    
  } catch (error: any) {
    console.error('Error analyzing resume fit:', error);
    throw new Error(error.message || 'Failed to analyze resume. Please ensure the PDF is valid and try again.');
  }
}