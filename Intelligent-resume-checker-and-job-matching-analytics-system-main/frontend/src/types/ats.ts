export interface Job {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string;
  responsibilities: string;
  experienceLevel: 'fresher' | '1-3 years' | '3-5 years' | 'senior';
  salaryMin: string;
  salaryMax: string;
  jobType: 'full-time' | 'part-time' | 'internship' | 'remote';
  skills: string[];
  status: 'active' | 'draft' | 'closed';
  createdAt: Date;
}

export interface Resume {
  id: string;
  fileName: string;
  candidateName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  education: string;
  rawText: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'screening' | 'reviewed';
  jobId?: string;
  uploadedAt: Date;
}

export interface Candidate {
  id: string;
  resumeId: string;
  jobId: string;
  name: string;
  email: string;
  matchScore: number;
  skillMatch: SkillMatch[];
  skillGaps: string[];
  experienceScore: number;
  educationScore: number;
  overallFit: string;
  strengths: string[];
  weaknesses: string[];
  flags: string[];
  aiExplanation: AIExplanation;
  status: 'pending' | 'shortlisted' | 'rejected' | 'interview' | 'hired';
}

export interface SkillMatch {
  skill: string;
  required: boolean;
  matched: boolean;
  proficiency: number; // 0-100
}

export interface AIExplanation {
  summary: string;
  factors: DecisionFactor[];
  confidence: number;
  recommendation: string;
}

export interface DecisionFactor {
  name: string;
  score: number;
  weight: number;
  reasoning: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: 'shortlist' | 'rejection' | 'interview' | 'offer';
  subject: string;
  body: string;
}

export interface EmailRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  templateType: string;
  subject: string;
  status: 'sent' | 'pending' | 'failed';
  sentAt: Date;
}

export type ActivityItem = {
  id: string;
  type: 'resume_uploaded' | 'candidate_screened' | 'job_created' | 'email_sent' | 'candidate_shortlisted';
  message: string;
  timestamp: Date;
};