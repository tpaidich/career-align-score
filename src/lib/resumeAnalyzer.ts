import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { TfIdf, WordTokenizer } from 'natural';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

interface AnalysisResult {
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  insights: string[];
  topKeywords: { word: string; score: number }[];
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

// Clean and tokenize text
function cleanAndTokenize(text: string): string[] {
  const tokenizer = new WordTokenizer();
  return tokenizer.tokenize(text.toLowerCase()) || [];
}

// Extract skills from text
function extractSkills(text: string): string[] {
  const words = text.toLowerCase();
  return commonSkills.filter(skill => 
    words.includes(skill.toLowerCase())
  );
}

// Calculate TF-IDF similarity
function calculateTFIDFSimilarity(text1: string, text2: string): number {
  const tfidf = new TfIdf();
  
  tfidf.addDocument(cleanAndTokenize(text1));
  tfidf.addDocument(cleanAndTokenize(text2));
  
  const terms1 = new Set(cleanAndTokenize(text1));
  let similarity = 0;
  let totalTerms = 0;
  
  terms1.forEach(term => {
    const score1 = tfidf.tfidf(term, 0);
    const score2 = tfidf.tfidf(term, 1);
    if (score1 > 0 && score2 > 0) {
      similarity += Math.min(score1, score2);
    }
    totalTerms++;
  });
  
  return totalTerms > 0 ? (similarity / totalTerms) * 100 : 0;
}

// Get top keywords with their TF-IDF scores
function getTopKeywords(jobDescription: string, resumeText: string): { word: string; score: number }[] {
  const tfidf = new TfIdf();
  const jobTokens = cleanAndTokenize(jobDescription);
  const resumeTokens = cleanAndTokenize(resumeText);
  
  tfidf.addDocument(jobTokens);
  tfidf.addDocument(resumeTokens);
  
  const keywordScores: { [key: string]: number } = {};
  
  // Get TF-IDF scores for job description terms that also appear in resume
  jobTokens.forEach(term => {
    if (resumeTokens.includes(term) && term.length > 2) {
      keywordScores[term] = tfidf.tfidf(term, 0);
    }
  });
  
  return Object.entries(keywordScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([word, score]) => ({ word, score }));
}

// Generate insights based on analysis
function generateInsights(
  fitScore: number, 
  matchedSkills: string[], 
  missingSkills: string[],
  jobDescription: string,
  resumeText: string
): string[] {
  const insights: string[] = [];
  
  if (fitScore >= 80) {
    insights.push("Excellent match! Your resume aligns very well with the job requirements.");
  } else if (fitScore >= 60) {
    insights.push("Good match with room for improvement. Consider highlighting relevant experience more prominently.");
  } else if (fitScore >= 40) {
    insights.push("Moderate match. Focus on developing the missing skills and better showcasing relevant experience.");
  } else {
    insights.push("Limited match. Consider gaining experience in the key areas mentioned in the job description.");
  }
  
  if (matchedSkills.length > 0) {
    insights.push(`Strong alignment in ${matchedSkills.slice(0, 3).join(', ')} skills.`);
  }
  
  if (missingSkills.length > 0) {
    insights.push(`Consider developing skills in ${missingSkills.slice(0, 3).join(', ')} to improve your match.`);
  }
  
  // Check for experience indicators
  const experienceKeywords = ['years', 'experience', 'led', 'managed', 'developed', 'created'];
  const hasExperienceIndicators = experienceKeywords.some(keyword => 
    resumeText.toLowerCase().includes(keyword)
  );
  
  if (!hasExperienceIndicators) {
    insights.push("Consider adding more specific examples of your accomplishments and years of experience.");
  }
  
  // Check for soft skills
  const softSkills = ['leadership', 'communication', 'teamwork', 'problem solving'];
  const hasSoftSkills = softSkills.some(skill => 
    resumeText.toLowerCase().includes(skill.toLowerCase())
  );
  
  if (jobDescription.toLowerCase().includes('leadership') && !hasSoftSkills) {
    insights.push("The role requires leadership skills - consider highlighting your leadership experience.");
  }
  
  return insights;
}

export async function analyzeFit(jobDescription: string, resumeFile: File): Promise<AnalysisResult> {
  try {
    // Extract text from PDF
    const resumeText = await extractTextFromPDF(resumeFile);
    
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
      adjustedFitScore = (baseFitScore * 0.6) + (skillMatchRatio * 100 * 0.4);
    }
    
    // Cap the score at 100 and ensure minimum of 0
    const finalFitScore = Math.min(100, Math.max(0, Math.round(adjustedFitScore)));
    
    // Get top keywords
    const topKeywords = getTopKeywords(jobDescription, resumeText);
    
    // Generate insights
    const insights = generateInsights(
      finalFitScore, 
      matchedSkills, 
      missingSkills, 
      jobDescription, 
      resumeText
    );
    
    return {
      fitScore: finalFitScore,
      matchedSkills: [...new Set(matchedSkills)], // Remove duplicates
      missingSkills: [...new Set(missingSkills)], // Remove duplicates
      insights,
      topKeywords
    };
    
  } catch (error) {
    console.error('Error analyzing resume fit:', error);
    throw new Error('Failed to analyze resume. Please ensure the PDF is valid and try again.');
  }
}