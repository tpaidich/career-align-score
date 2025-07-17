import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// TODO: Replace with your actual Gemini API key, ideally from an environment variable
// For example, if using Vite, you might define it in .env and access via import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=';

// Utility function to introduce a delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
  
  // Calculate term frequencies
  const tf1 = calculateTermFrequency(tokens1);
  const tf2 = calculateTermFrequency(tokens2);
  
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

// Get top keywords with their scores (custom implementation)
// This function is being removed/repurposed as per the new design.
// Its functionality will be absorbed by more specific LLM calls for insights.
// async function getTopKeywords(jobDescription: string, resumeText: string): Promise<{ word: string; score: number }[]> {
//   try {
//     // Attempt to extract keywords using Gemini LLM
//     const llmKeywords = await extractKeywordsWithGemini(jobDescription, resumeText);
//     if (llmKeywords && llmKeywords.length > 0) {
//       // Assign a default high score to LLM-extracted keywords for prioritization
//       return llmKeywords.map(word => ({ word, score: 1.0 }));
//     }
//   } catch (error) {
//     console.warn("Gemini LLM keyword extraction failed, falling back to rule-based extraction:", error);
//     // Fallback to existing logic if LLM extraction fails
//   }

//   const jobTokens = cleanAndTokenize(jobDescription);
//   const resumeTokens = cleanAndTokenize(resumeText);
  
//   // Calculate term frequencies
//   const jobTF = calculateTermFrequency(jobTokens);
//   const resumeTF = calculateTermFrequency(resumeTokens);
  
//   const keywordScores: { [key: string]: number } = {};
  
//   // Combine common skills and technical keywords for a comprehensive list
//   const relevantTerms = new Set([
//     ...commonSkills.map(s => s.toLowerCase()),
//     ...technicalKeywords.map(k => k.toLowerCase())
//   ]);

//   // Find keywords that appear in both texts and are relevant terms
//   Object.keys(jobTF).forEach(term => {
//     if (resumeTF[term] && term.length > 2 && relevantTerms.has(term)) {
//       // Score based on frequency in both documents
//       keywordScores[term] = (jobTF[term] + resumeTF[term]) / 2;
//     }
//   });
  
//   // If less than 8 relevant keywords, fill with other common keywords that are not stop words
//   if (Object.keys(keywordScores).length < 8) {
//     const allCommonKeywords = new Set([...Object.keys(jobTF), ...Object.keys(resumeTF)]);
//     allCommonKeywords.forEach(term => {
//       if (term.length > 2 && !stopWords.has(term) && !relevantTerms.has(term)) {
//         if (jobTF[term] && resumeTF[term]) {
//           keywordScores[term] = (jobTF[term] + resumeTF[term]) / 2;
//         }
//       }
//     });
//   }

//   return Object.entries(keywordScores)
//     .sort(([,a], [,b]) => b - a)
//     .slice(0, 8)
//     .map(([word, score]) => ({ word, score }));
// }

// Function to extract keywords using Gemini LLM
async function extractKeywordsWithGemini(jobDescription: string, resumeText: string): Promise<string[]> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("Gemini API key is not configured. Skipping LLM keyword extraction.");
    return [];
  }

  const prompt = `Given the following job description and resume text, identify the 16 most important technical skills, tools, and keywords that appear in both. Focus on terms relevant to software development, data science, or engineering. Provide the response as a JSON array of strings, for example: ["React", "TypeScript", "AWS", "Python", "Machine Learning"].\n\nJob Description:\n${jobDescription}\n\nResume Text:\n${resumeText}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}${GEMINI_API_KEY}` , {
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0]?.content?.parts[0]?.text;

    if (textResponse) {
      // Attempt to parse the JSON array from the LLM's text response
      const cleanedResponse = textResponse.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedResponse);
    }
    return [];

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error; // Re-throw to be caught by getTopKeywords fallback
  }
}

// Function to rank missing skills using Gemini LLM
async function rankMissingSkillsWithGemini(jobDescription: string, missingSkills: string[]): Promise<string[]> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("Gemini API key is not configured. Skipping LLM missing skill ranking.");
    return missingSkills; // Return original skills if LLM is not configured
  }

  if (missingSkills.length === 0) {
    return [];
  }

  const prompt = `Given the following job description, rank the importance of the following missing skills for this role, from most important to least important. Provide the response as a JSON array of strings, for example: ["Skill A", "Skill B", "Skill C"].\n\nJob Description:\n${jobDescription}\n\nMissing Skills:\n${missingSkills.join(', ')}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}${GEMINI_API_KEY}` , {
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0]?.content?.parts[0]?.text;

    if (textResponse) {
      const cleanedResponse = textResponse.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedResponse);
    }
    return missingSkills; // Fallback to original order if parsing fails

  } catch (error) {
    console.error("Error calling Gemini API for skill ranking:", error);
    return missingSkills; // Fallback to original order on error
  }
}

// Generate insights based on analysis
async function generateInsights(
  fitScore: number, 
  matchedSkills: string[], 
  missingSkills: string[],
  jobDescription: string,
  resumeText: string
): Promise<string[]> {
  const insights: string[] = [];
  
  // Rank missing skills using LLM
  const rankedMissingSkills = await rankMissingSkillsWithGemini(jobDescription, missingSkills);
  await delay(500); // Add a small delay

  // Fit score messages (first insight)
  if (fitScore < 50) {
    insights.push("This role might not be the best fit for you. Consider focusing on roles that align more closely with your current skill set.");
  } else if (fitScore >= 50 && fitScore < 60) {
    insights.push("A moderate match. You have some relevant skills, but significant gaps exist. Focus on developing key missing areas.");
  } else if (fitScore >= 60 && fitScore < 70) {
    insights.push("Good match! You meet many requirements, but there's room to grow. Highlight your strengths and consider upskilling in a few areas.");
  } else if (fitScore >= 70 && fitScore < 80) {
    insights.push("Strong match! Your resume aligns well with the job. Emphasize your strongest points and address minor skill gaps.");
  } else { // 80-100%
    insights.push("Excellent match! Your resume aligns very well with the job requirements. You are a highly suitable candidate.");
  }
  
  // General alignment paragraph (second insight)
  const generalAlignmentPrompt = `Based on the fit score (${fitScore}%), the matched skills (${matchedSkills.join(', ') || 'none'}), and missing skills (${missingSkills.join(', ') || 'none'}) for the job description:\n\nJob Description:\n${jobDescription}\n\nResume Text (partial for context):\n${resumeText.substring(0, 500)}...
\nProvide a concise paragraph (1-2 sentences) summarizing the overall alignment of the resume with the job description. Be encouraging but honest about areas for improvement.`;

  try {
    const generalAlignmentResponse = await fetch(`${GEMINI_API_URL}${GEMINI_API_KEY}` , {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: generalAlignmentPrompt
          }]
        }]
      }),
    });

    if (generalAlignmentResponse.ok) {
      const data = await generalAlignmentResponse.json();
      const textResponse = data.candidates[0]?.content?.parts[0]?.text;
      if (textResponse) {
        insights.push(textResponse.trim());
      }
    } else {
      console.warn("Failed to get general alignment insight from LLM.");
    }
  } catch (error) {
    console.error("Error fetching general alignment insight:", error);
  }

  if (matchedSkills.length > 0) {
    insights.push(`Strong alignment in ${matchedSkills.slice(0, 3).join(', ')} skills.`);
  }
  
  if (rankedMissingSkills.length > 0) {
    insights.push(`Consider developing skills in ${rankedMissingSkills.slice(0, 3).join(', ')} to significantly improve your match.`);
  }
  
  // Remove redundant specific insights if general insights are robust
  // This part needs careful consideration to avoid duplication if LLM is already providing these.
  // For now, I'll keep the existing specific insights as well, but we can refine if needed.

  return insights;
}

// New LLM calls for specific insights
async function getHighlightAreasWithGemini(jobDescription: string, resumeText: string): Promise<string[]> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("Gemini API key is not configured. Skipping LLM highlight areas.");
    return [];
  }

  const prompt = `Given the following job description and resume text, identify 5-7 *specific areas, keywords, experiences, or projects from the resume* that are most relevant to the job description and should be highlighted. Provide concrete examples where possible. Provide the response as a JSON array of strings. Each string should be a concise actionable point. For example: ["Emphasize \"React\" experience in the technical skills section", "Highlight the \"E-commerce Platform Development\" project from your resume as it aligns with scalable systems.", "Draw attention to your \"Project Management\" experience under the professional experience section."]\n\nJob Description:\n${jobDescription}\n\nResume Text:\n${resumeText}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}${GEMINI_API_KEY}` , {
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0]?.content?.parts[0]?.text;

    if (textResponse) {
      const cleanedResponse = textResponse.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedResponse);
    }
    return [];

  } catch (error) {
    console.error("Error calling Gemini API for highlight areas:", error);
    return [];
  }
}

async function getProjectSuggestionsWithGemini(jobDescription: string, missingSkills: string[]): Promise<string[]> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("Gemini API key is not configured. Skipping LLM project suggestions.");
    return [];
  }

  if (missingSkills.length === 0) {
    return [];
  }

  const prompt = `Given the following job description and a list of missing skills, suggest 2-3 broader project concepts or side projects that would help improve your portfolio for this role. For each project, provide a brief title, things to add to the project, and skills it will prove. Format each project as a single string within a JSON array, ensuring newlines are escaped as \\n. Like this example: ["Project Title One\\n- E.g. Things to add: Implement a feature with [specific technology]\\n- E.g. Skills this will prove: [Skill 1], [Skill 2]", "Project Title Two\\n- E.g. Things to add: Integrate with a [type] API\\n- E.g. Skills this will prove: [Skill 3], [Skill 4]"]\n\nJob Description:\n${jobDescription}\n\nMissing Skills:\n${missingSkills.join(', ')}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}${GEMINI_API_KEY}` , {
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0]?.content?.parts[0]?.text;

    if (textResponse) {
      const cleanedResponse = textResponse.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedResponse);
    }
    return [];

  } catch (error) {
    console.error("Error calling Gemini API for project suggestions:", error);
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
    
    // Extract skills from both texts
    const jobSkills = extractSkills(jobDescription);
    const resumeSkills = extractSkills(resumeText);
    
    // Calculate skill-based adjustments
    const matchedSkills = resumeSkills.filter(skill => jobSkills.includes(skill));
    const missingSkills = jobSkills.filter(skill => !resumeSkills.includes(skill));
    
    // Adjust fit score based on skill matching
    let adjustedFitScore = baseFitScore;
    if (jobSkills.length > 0) {
      const skillMatchRatio = matchedSkills.length / jobSkills.length;
      adjustedFitScore = (baseFitScore * 0.3) + (skillMatchRatio * 100 * 0.7); // Changed weights to 0.7 and 0.3
    }
    
    // Cap the score at 100 and ensure minimum of 0
    const finalFitScore = Math.min(100, Math.max(0, Math.round(adjustedFitScore)));
    
    onProgress?.("Generating insights and ranking skills...");
    // Generate insights
    const insights = await generateInsights(
      finalFitScore, 
      matchedSkills, 
      missingSkills, 
      jobDescription, 
      resumeText
    );
    await delay(500); // Add a small delay after generateInsights

    onProgress?.("Identifying areas to highlight...");
    // New LLM calls for specific insights
    const highlightAreas = await getHighlightAreasWithGemini(jobDescription, resumeText);
    await delay(500); // Add a small delay after getHighlightAreas

    onProgress?.("Suggesting projects...");
    const projectSuggestions = await getProjectSuggestionsWithGemini(jobDescription, missingSkills);
    await delay(500); // Add a small delay after getProjectSuggestions

    return {
      fitScore: finalFitScore,
      matchedSkills: [...new Set(matchedSkills)], // Remove duplicates
      missingSkills: [...new Set(missingSkills)], // Remove duplicates
      insights,
      // topKeywords, // Removed
      fitMessage: insights[0],
      highlightAreas,
      projectSuggestions
    };
    
  } catch (error: any) {
    console.error('Error analyzing resume fit:', error);
    throw new Error(error.message || 'Failed to analyze resume. Please ensure the PDF is valid and try again.');
  }
}