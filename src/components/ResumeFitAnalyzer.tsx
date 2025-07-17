import React, { useState } from 'react';
import { Upload, FileText, BarChart3, Download, Target, CheckCircle, XCircle, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { analyzeFit } from '@/lib/resumeAnalyzer';
import { useTheme } from "next-themes"; // Import useTheme hook

interface AnalysisResult {
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  insights: string[]; // This will now hold general insights *excluding* the fit message
  fitMessage: string;
  highlightAreas: string[]; // New field for LLM-generated highlight areas
  projectSuggestions: string[]; // New field for LLM-generated project suggestions
}

export function ResumeFitAnalyzer() {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(''); // New state for analysis stage
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme(); // Initialize useTheme

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      toast({
        title: "PDF Uploaded",
        description: `${file.name} is ready for analysis`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || !resumeFile) {
      toast({
        title: "Missing Information",
        description: "Please provide both job description and resume PDF",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStage("Starting analysis...");
    try {
      const analysisResult = await analyzeFit(jobDescription, resumeFile, (stage) => setAnalysisStage(stage)); // Pass stage setter
      // Ensure the fitMessage is correctly extracted and removed from insights for display
      const fitMessage = analysisResult.insights[0] || ""; // Get the first insight as the fit message
      const generalInsights = analysisResult.insights.slice(1); // Remaining insights are general

      setResult({
        ...analysisResult,
        insights: generalInsights,
        fitMessage: fitMessage,
      });
      toast({
        title: "Analysis Complete",
        description: `Your resume has a ${analysisResult.fitScore}% match with the job description`,
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "There was an error analyzing your resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    const reportContent = `
Resume Fit Analysis Report
=========================

Fit Score: ${result.fitScore}%
Fit Message: ${result.fitMessage}

Matched Skills:
${result.matchedSkills.map(skill => `• ${skill}`).join('\n')}

Missing Skills:
${result.missingSkills.map(skill => `• ${skill}`).join('\n')}

Areas to Highlight:
${result.highlightAreas.length > 0 ? result.highlightAreas.map(area => `• ${area}`).join('\n') : 'N/A'}

Project Suggestions:
${result.projectSuggestions.length > 0 ? result.projectSuggestions.map(project => `• ${project}`).join('\n') : 'N/A'}

General Insights:
${result.insights.length > 0 ? result.insights.map(insight => `• ${insight}`).join('\n') : 'N/A'}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume-fit-analysis-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg gradient-primary">
              <Target className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Resume Scorer - Am I a good fit for this job?</h1>
            <Badge variant="secondary" className="ml-auto">
              AI-Powered Analysis
            </Badge>
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="ml-2"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Introduction */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold gradient-hero bg-clip-text text-transparent">
              Analyze Your Resume Fit
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your resume and paste a job description to get an AI-powered analysis 
              of how well your skills match the role's requirements! Receive personalized suggestions
              and unlock key insights.
            </p>
          </div>

          {/* Input Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Job Description */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Job Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="job-description">
                  Paste the job description you want to match against
                </Label>
                <Textarea
                  id="job-description"
                  placeholder="Paste the full job description here..."
                  className="mt-2 min-h-[200px] resize-none"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {jobDescription.length} characters
                </p>
              </CardContent>
            </Card>

            {/* Resume Upload */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-secondary" />
                  Resume Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="resume-upload">Upload your resume (PDF only)</Label>
                <div className="mt-2">
                  <input
                    id="resume-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full h-32 border-dashed border-2 hover:border-primary transition-smooth"
                    onClick={() => document.getElementById('resume-upload')?.click()}
                  >
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm">
                        {resumeFile ? resumeFile.name : 'Click to upload PDF'}
                      </p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analyze Button */}
          <div className="text-center">
            <Button
              onClick={handleAnalyze}
              disabled={!jobDescription.trim() || !resumeFile || isAnalyzing}
              size="lg"
              className="gradient-primary text-primary-foreground font-semibold px-8 py-3 hover:shadow-glow transition-smooth"
            >
              {isAnalyzing ? (
                <>
                  <BarChart3 className="mr-2 h-5 w-5 animate-pulse" />
                  Analyzing... {analysisStage}
                </>
              ) : (
                <>
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Analyze Resume Fit
                </>
              )}
            </Button>
          </div>

          {/* Results Section */}
          {result && (
            <div className="space-y-6">
              {/* Fit Score */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Overall Fit Score
                    </span>
                    <Button variant="outline" size="sm" onClick={downloadReport}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Report
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold gradient-hero bg-clip-text text-transparent">
                        {result.fitScore}%
                      </div>
                      <p className="text-muted-foreground">Match Score</p>
                    </div>
                    <Progress value={result.fitScore} className="h-3" />
                    <div className="text-center text-sm text-muted-foreground mt-2">
                      {result.fitMessage}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Skills Analysis */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Matched Skills */}
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-5 w-5" />
                      Matched Skills ({result.matchedSkills.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.matchedSkills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="bg-success/10 text-success">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Missing Skills */}
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-warning">
                      <XCircle className="h-5 w-5" />
                      Missing Skills ({result.missingSkills.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.missingSkills.map((skill, index) => (
                        <Badge key={index} variant="outline" className="border-warning text-warning">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Insights and Suggestions */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Key Insights & Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.highlightAreas.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">What areas can I highlight in my resume?</h3>
                      <ul className="space-y-1 list-disc pl-5">
                        {result.highlightAreas.map((area, index) => (
                          <li key={index} className="text-sm">{area}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.projectSuggestions.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">What are some projects I can work on to improve my portfolio?</h3>
                      <ul className="space-y-4">
                        {result.projectSuggestions.map((project, index) => (
                          <li key={index} className="text-sm whitespace-pre-wrap">{project}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.insights.length > 0 && result.insights[0] && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">General Alignment:</h3>
                      <p className="text-sm text-muted-foreground">
                        {result.insights[0]}
                      </p>
                    </div>
                  )}
                  {(result.highlightAreas.length === 0 && result.projectSuggestions.length === 0 && result.insights.length === 0) && (
                    <p className="text-sm text-muted-foreground">No specific insights or suggestions were generated at this time.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}