import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Job, Resume, Candidate, EmailRecord, EmailTemplate, ActivityItem } from '@/types/ats';

const defaultTemplates: EmailTemplate[] = [
  {
    id: '1',
    name: 'Shortlist Notification',
    type: 'shortlist',
    subject: 'Congratulations! You\'ve been shortlisted for {{jobTitle}}',
    body: 'Dear {{candidateName}},\n\nWe are pleased to inform you that you have been shortlisted for the position of {{jobTitle}}. We were impressed by your qualifications and experience.\n\nWe will be in touch shortly with the next steps.\n\nBest regards,\nHR Team',
  },
  {
    id: '2',
    name: 'Rejection Notice',
    type: 'rejection',
    subject: 'Update on your application for {{jobTitle}}',
    body: 'Dear {{candidateName}},\n\nThank you for your interest in the {{jobTitle}} position and for taking the time to apply.\n\nAfter careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.\n\nWe encourage you to apply for future openings.\n\nBest regards,\nHR Team',
  },
  {
    id: '3',
    name: 'Interview Invitation',
    type: 'interview',
    subject: 'Interview Invitation - {{jobTitle}}',
    body: 'Dear {{candidateName}},\n\nWe would like to invite you for an interview for the {{jobTitle}} position.\n\nPlease let us know your availability for the coming week.\n\nBest regards,\nHR Team',
  },
  {
    id: '4',
    name: 'Offer Letter',
    type: 'offer',
    subject: 'Job Offer - {{jobTitle}}',
    body: 'Dear {{candidateName}},\n\nWe are excited to extend an offer for the {{jobTitle}} position.\n\nPlease review the attached offer details and let us know your decision.\n\nBest regards,\nHR Team',
  },
];

function loadFromStorage<T>(key: string, fallback: T, reviver?: (k: string, v: any) => any): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw, reviver);
  } catch {
    return fallback;
  }
}

function dateReviver(_key: string, value: any) {
  if (typeof value === 'string') {
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
    if (iso) return new Date(value);
  }
  return value;
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently fail
  }
}

interface ATSContextType {
  jobs: Job[];
  resumes: Resume[];
  candidates: Candidate[];
  emailRecords: EmailRecord[];
  emailTemplates: EmailTemplate[];
  activities: ActivityItem[];
  addJob: (job: Job) => void;
  updateJob: (job: Job) => void;
  deleteJob: (id: string) => void;
  addResume: (resume: Resume) => void;
  updateResume: (resume: Resume) => void;
  deleteResume: (id: string) => void;
  addCandidate: (candidate: Candidate) => void;
  updateCandidate: (candidate: Candidate) => void;
  deleteCandidate: (id: string) => void;
  addEmailRecord: (record: EmailRecord) => void;
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  setResumes: (resumes: Resume[]) => void;
  setJobs: (jobs: Job[]) => void;
}

const ATSContext = createContext<ATSContextType | undefined>(undefined);

export const ATSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [jobs, setJobsState] = useState<Job[]>(() =>
    loadFromStorage<Job[]>('ats_jobs', [], dateReviver)
  );

  const [resumes, setResumesState] = useState<Resume[]>(() =>
    loadFromStorage<Resume[]>('ats_resumes', [], dateReviver)
  );

  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    loadFromStorage<Candidate[]>('ats_candidates', [], dateReviver)
  );

  const [emailRecords, setEmailRecords] = useState<EmailRecord[]>(() =>
    loadFromStorage<EmailRecord[]>('ats_email_records', [], dateReviver)
  );

  const [emailTemplates] = useState<EmailTemplate[]>(defaultTemplates);

  const [activities, setActivities] = useState<ActivityItem[]>(() =>
    loadFromStorage<ActivityItem[]>('ats_activities', [], dateReviver)
  );

  useEffect(() => { saveToStorage('ats_jobs', jobs); }, [jobs]);
  useEffect(() => { saveToStorage('ats_resumes', resumes); }, [resumes]);
  useEffect(() => { saveToStorage('ats_candidates', candidates); }, [candidates]);
  useEffect(() => { saveToStorage('ats_email_records', emailRecords); }, [emailRecords]);
  useEffect(() => { saveToStorage('ats_activities', activities); }, [activities]);

  const addActivity = useCallback((activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    setActivities(prev => [{
      ...activity,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }, ...prev].slice(0, 50));
  }, []);

  const setJobs = useCallback((newJobs: Job[]) => {
    setJobsState(newJobs);
  }, []);

  const setResumes = useCallback((newResumes: Resume[]) => {
    setResumesState(newResumes);
  }, []);

  const addJob = useCallback((job: Job) => {
    setJobsState(prev => {
      if (prev.find(j => j.id === job.id)) return prev;
      return [...prev, job];
    });
    addActivity({ type: 'job_created', message: `New job posted: ${job.title}` });
  }, [addActivity]);

  const updateJob = useCallback((job: Job) => {
    setJobsState(prev => prev.map(j => j.id === job.id ? job : j));
  }, []);

  const deleteJob = useCallback((id: string) => {
    setJobsState(prev => prev.filter(j => j.id !== id));
  }, []);

  const addResume = useCallback((resume: Resume) => {
    setResumesState(prev => {
      if (prev.find(r => r.id === resume.id)) return prev;
      return [...prev, resume];
    });
    addActivity({ type: 'resume_uploaded', message: `Resume uploaded: ${resume.fileName}` });
  }, [addActivity]);

  const updateResume = useCallback((resume: Resume) => {
    setResumesState(prev => prev.map(r => r.id === resume.id ? resume : r));
  }, []);

  const deleteResume = useCallback((id: string) => {
    setResumesState(prev => prev.filter(r => r.id !== id));
    // Also remove associated candidates
    setCandidates(prev => prev.filter(c => c.resumeId !== id));
  }, []);

  const addCandidate = useCallback((candidate: Candidate) => {
    setCandidates(prev => {
      if (prev.find(c => c.id === candidate.id)) return prev;

      const newCandidate = {
        ...candidate,

        appliedAt: new Date(),       // ✅ ADD THIS
        shortlistedAt: null,         // ✅ ADD THIS
        hiredAt: null                // ✅ ADD THIS
      };

      return [...prev, newCandidate];
    });

    addActivity({
      type: 'candidate_screened',
      message: `Candidate screened: ${candidate.name} (${candidate.matchScore}% match)`,
    });
  }, [addActivity]);

  const updateCandidate = useCallback((candidate: Candidate) => {
    setCandidates(prev =>
      prev.map(c => {
        if (c.id !== candidate.id) return c;

        let updated = { ...candidate };
        if (!c.appliedAt) updated.appliedAt = new Date();

        // ✅ shortlist date add
        if (candidate.status === "shortlisted" && !c.shortlistedAt) {
          updated.shortlistedAt = new Date();
        }

        // ✅ hired date add
        if (candidate.status === "hired" && !c.hiredAt) {
          updated.hiredAt = new Date();
        }

        return updated;
      })
    );
  }, []);
  const deleteCandidate = useCallback((id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
  }, []);

  const addEmailRecord = useCallback((record: EmailRecord) => {
    setEmailRecords(prev => [...prev, record]);
    addActivity({ type: 'email_sent', message: `Email sent to ${record.candidateName}` });
  }, [addActivity]);

  return (
    <ATSContext.Provider value={{
      jobs, resumes, candidates, emailRecords, emailTemplates, activities,
      addJob, updateJob, deleteJob,
      addResume, updateResume, deleteResume,
      addCandidate, updateCandidate, deleteCandidate,
      addEmailRecord, addActivity,
      setResumes, setJobs,
    }}>
      {children}
    </ATSContext.Provider>
  );
};

export const useATS = () => {
  const context = useContext(ATSContext);
  if (!context) throw new Error('useATS must be used within ATSProvider');
  return context;
};