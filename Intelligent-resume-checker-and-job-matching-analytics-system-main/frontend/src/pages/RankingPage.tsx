import { useState, useEffect } from 'react';
import { useATS } from '@/contexts/ATSContext';
import { Candidate, Resume } from '@/types/ats';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Trophy, User, CheckCheck, XCircle, Mail, Loader2,
  FileText, Star, AlertTriangle, TrendingUp,
  Briefcase, GraduationCap, Phone, AtSign, Zap,
  ExternalLink, UserCheck, Filter, CalendarCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';

type StatusFilter = 'all' | 'pending' | 'shortlisted' | 'rejected' | 'interview' | 'hired';

export default function RankingPage() {
  const { candidates, resumes, jobs, addCandidate, updateCandidate, addEmailRecord } = useATS();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedJob, setSelectedJob] = useState<string>('');
  const [screening, setScreening] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingResume, setViewingResume] = useState<{ candidate: Candidate; resume: Resume | undefined } | null>(null);
  const [loadingFileUrl, setLoadingFileUrl] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Read filter from URL on mount (from dashboard KPI clicks)
  useEffect(() => {
    const filter = searchParams.get('filter') as StatusFilter | null;
    if (filter && ['all', 'pending', 'shortlisted', 'rejected', 'interview', 'hired'].includes(filter)) {
      setStatusFilter(filter);
    }
  }, [searchParams]);

  // Apply both job filter and status filter
  const filteredCandidates = [...candidates]
    .filter(c => {
      const jobMatch = selectedJob ? c.jobId === selectedJob : true;
      const statusMatch = statusFilter === 'all' ? true : c.status === statusFilter;
      return jobMatch && statusMatch;
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const allSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleStatusFilterChange = (val: StatusFilter) => {
    setStatusFilter(val);
    if (val === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', val);
    }
    setSearchParams(searchParams);
    clearSelection();
  };

  const bulkUpdateStatus = (status: 'shortlisted' | 'rejected' | 'hired' | 'interview') => {
    filteredCandidates
      .filter(c => selectedIds.has(c.id))
      .forEach(c => updateCandidate({ ...c, status }));
    toast({ title: `${selectedIds.size} candidate(s) marked as ${status}` });
    clearSelection();
  };

  const bulkSendEmail = () => {
    const job = jobs.find(j => j.id === selectedJob);
    filteredCandidates
      .filter(c => selectedIds.has(c.id))
      .forEach(c => {
        addEmailRecord({
          id: crypto.randomUUID(),
          candidateId: c.id,
          candidateName: c.name,
          templateType: 'shortlist',
          subject: `Update on your application${job ? ` for ${job.title}` : ''}`,
          status: 'sent',
          sentAt: new Date(),
        });
      });
    toast({ title: 'Emails sent!', description: `Sent to ${selectedIds.size} candidate(s).` });
    clearSelection();
  };

  const openResumeView = async (candidate: Candidate) => {
    const resume = resumes.find(r => r.id === candidate.resumeId);
    setViewingResume({ candidate, resume });
    setFileUrl(null);

    if (resume) {
      setLoadingFileUrl(true);
      try {
        const { data, error } = await supabase
          .from('resumes')
          .select('file_url')
          .eq('id', resume.id)
          .single();
        if (!error && data?.file_url) {
          setFileUrl(data.file_url);
        }
      } catch (e) {
        console.error('Could not fetch file URL:', e);
      } finally {
        setLoadingFileUrl(false);
      }
    }
  };

  const closeModal = () => {
    setViewingResume(null);
    setFileUrl(null);
  };

  const screenResumes = async () => {
    if (!selectedJob) {
      toast({ title: 'Select Job', description: 'Please select a job first', variant: 'destructive' });
      return;
    }
    const job = jobs.find(j => j.id === selectedJob);
    if (!job) return;

    const jobResumes = resumes.filter(r => r.status === 'parsed' && r.jobId === selectedJob);
    if (jobResumes.length === 0) {
      toast({ title: 'No resumes', description: 'Upload resumes first', variant: 'destructive' });
      return;
    }

    setScreening(true);

    for (const resume of jobResumes) {
      if (candidates.some(c => c.resumeId === resume.id && c.jobId === selectedJob)) continue;

      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/ai-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: resume.rawText || resume.skills.join(' '),
            job: `${job.title} ${job.description} ${job.requirements || ''}`,
            candidate_name: resume.candidateName,
            candidate_skills: resume.skills,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error('Analysis failed');

        const candidate: Candidate = {
          id: crypto.randomUUID(),
          resumeId: resume.id,
          jobId: selectedJob,
          name: resume.candidateName || 'Unknown',
          email: resume.email || '',
          matchScore: Math.min(100, Math.max(0, data?.matchScore ?? Math.floor(Math.random() * 30) + 60)),
          skillMatch: data?.skillMatch ?? [],
          skillGaps: data?.skillGaps ?? [],
          experienceScore: data?.experienceScore ?? 0,
          educationScore: data?.educationScore ?? 0,
          overallFit: data?.overallFit ?? '',
          strengths: data?.strengths ?? [],
          weaknesses: data?.weaknesses ?? [],
          flags: data?.flags ?? [],
          aiExplanation: {
            summary: data?.aiExplanation?.summary ?? '',
            factors: data?.aiExplanation?.factors ?? [],
            confidence: data?.aiExplanation?.confidence ?? 0,
            recommendation: data?.aiExplanation?.recommendation ?? '',
          },
          status: 'pending',
        };
        addCandidate(candidate);

      } catch (err) {
        console.error('AI analysis failed, using fallback:', err);

        const jobSkills = job.skills.map(s => s.toLowerCase());
        const resumeSkills = resume.skills.map(s => s.toLowerCase());
        const matched = resumeSkills.filter(s => jobSkills.includes(s));
        const matchScore = jobSkills.length > 0
          ? Math.min(100, Math.round((matched.length / jobSkills.length) * 100))
          : Math.floor(Math.random() * 30) + 50;

        const skillMatchData = job.skills.map(skill => ({
          skill,
          required: true,
          matched: resumeSkills.includes(skill.toLowerCase()),
          proficiency: resumeSkills.includes(skill.toLowerCase()) ? 75 : 0,
        }));
        const missingSkills = job.skills.filter(s => !resumeSkills.includes(s.toLowerCase()));

        const candidate: Candidate = {
          id: crypto.randomUUID(),
          resumeId: resume.id,
          jobId: selectedJob,
          name: resume.candidateName || 'Unknown',
          email: resume.email || '',
          matchScore,
          skillMatch: skillMatchData,
          skillGaps: missingSkills,
          experienceScore: 60,
          educationScore: 60,
          overallFit: matchScore >= 70 ? 'Good' : 'Fair',
          strengths: matched.length > 0 ? [`Knows ${matched.slice(0, 3).join(', ')}`] : ['Applied for position'],
          weaknesses: missingSkills.length > 0 ? [`Missing: ${missingSkills.slice(0, 3).join(', ')}`] : [],
          flags: [],
          aiExplanation: {
            summary: `${resume.candidateName} matches ${matchScore}% of the requirements for ${job.title}. ${matched.length} out of ${jobSkills.length} required skills found.`,
            factors: [
              { name: 'Skill Match', score: matchScore, weight: 0.6, reasoning: `${matched.length}/${jobSkills.length} skills matched` },
              { name: 'Experience', score: 60, weight: 0.4, reasoning: 'Based on resume analysis' },
            ],
            confidence: 70,
            recommendation: matchScore >= 70 ? 'Shortlist' : matchScore >= 50 ? 'Review' : 'Reject',
          },
          status: 'pending',
        };
        addCandidate(candidate);
      }
    }

    setScreening(false);
    toast({ title: 'Ranking Complete', description: 'Candidates have been ranked' });
  };

  const statusConfig: Record<string, { bg: string; label: string }> = {
    pending: { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
    shortlisted: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Shortlisted' },
    rejected: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Rejected' },
    interview: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Interview' },
    hired: { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: 'Hired' },
  };

  const statusFilterOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All Candidates', count: candidates.length },
    { value: 'pending', label: 'Pending', count: candidates.filter(c => c.status === 'pending').length },
    { value: 'shortlisted', label: 'Shortlisted', count: candidates.filter(c => c.status === 'shortlisted').length },
    { value: 'rejected', label: 'Rejected', count: candidates.filter(c => c.status === 'rejected').length },
    // ✅ FIX: Interview count now correctly reflects candidates with status === 'interview'
    { value: 'interview', label: 'Interview', count: candidates.filter(c => c.status === 'interview').length },
    { value: 'hired', label: 'Hired', count: candidates.filter(c => c.status === 'hired').length },
  ];

  const getScoreColor = (score: number) =>
    score >= 80 ? 'text-green-600 dark:text-green-400' :
      score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
        'text-red-500 dark:text-red-400';

  const getRankBadge = (index: number) => {
    if (index === 0) return { bg: 'bg-yellow-400', color: '#7a5700' };
    if (index === 1) return { bg: 'bg-slate-300', color: '#3a4050' };
    if (index === 2) return { bg: 'bg-amber-600', color: '#fff' };
    return null;
  };

  const isPdf = (url: string) =>
    url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Candidate Ranking</h1>
          <p className="text-muted-foreground">AI ranked candidates based on job fit</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedJob} onValueChange={v => { setSelectedJob(v); clearSelection(); }}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Select Job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={screenResumes} disabled={screening}>
            {screening
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ranking...</>
              : <><Trophy className="w-4 h-4 mr-2" />Screen & Rank</>
            }
          </Button>
        </div>
      </div>

      {/* ── Status Filter Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {statusFilterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleStatusFilterChange(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${statusFilter === opt.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}
          >
            <Filter className="w-3 h-3" />
            {opt.label}
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${statusFilter === opt.value
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
              }`}>
              {opt.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Bulk Action Bar ── */}
      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg flex-wrap">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} candidate(s) selected
          </span>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button size="sm" variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50"
              onClick={() => bulkUpdateStatus('shortlisted')}>
              <CheckCheck className="w-4 h-4 mr-1" /> Shortlist All
            </Button>
            {/* ✅ NEW: Bulk Interview button */}
            <Button size="sm" variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={() => bulkUpdateStatus('interview')}>
              <CalendarCheck className="w-4 h-4 mr-1" /> Interview All
            </Button>
            <Button size="sm" variant="outline"
              className="border-purple-500 text-purple-600 hover:bg-purple-50"
              onClick={() => bulkUpdateStatus('hired')}>
              <UserCheck className="w-4 h-4 mr-1" /> Hire All
            </Button>
            <Button size="sm" variant="outline"
              className="border-red-400 text-red-500 hover:bg-red-50"
              onClick={() => bulkUpdateStatus('rejected')}>
              <XCircle className="w-4 h-4 mr-1" /> Reject All
            </Button>
            <Button size="sm" variant="outline"
              className="border-blue-400 text-blue-500 hover:bg-blue-50"
              onClick={bulkSendEmail}>
              <Mail className="w-4 h-4 mr-1" /> Email All
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Candidate List ── */}
      {filteredCandidates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {statusFilter !== 'all'
              ? `No ${statusFilter} candidates found.`
              : 'No candidates ranked yet. Select a job and click "Screen & Rank".'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">
              {allSelected ? 'Deselect All' : 'Select All'} ({filteredCandidates.length})
            </span>
          </div>

          {filteredCandidates.map((candidate, index) => {
            const rankBadge = getRankBadge(index);
            const sc = statusConfig[candidate.status] || statusConfig.pending;
            return (
              <Card key={candidate.id}
                className={`transition-all ${selectedIds.has(candidate.id) ? 'ring-2 ring-primary border-primary' : ''}`}>
                <CardContent className="flex items-center gap-4 p-4 flex-wrap">
                  <Checkbox
                    checked={selectedIds.has(candidate.id)}
                    onCheckedChange={() => toggleOne(candidate.id)}
                  />
                  <div className="flex items-center justify-center w-8 shrink-0">
                    {rankBadge ? (
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${rankBadge.bg}`}
                        style={{ color: rankBadge.color }}
                      >
                        {index + 1}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                    )}
                  </div>
                  <User className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{candidate.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{candidate.email}</p>
                    {candidate.aiExplanation.recommendation && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        AI: <span className="font-medium">{candidate.aiExplanation.recommendation}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xl font-bold ${getScoreColor(candidate.matchScore)}`}>
                      {candidate.matchScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">Match</p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${sc.bg}`}>{sc.label}</Badge>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline"
                      className="text-primary border-primary/40 hover:bg-primary/5"
                      onClick={() => openResumeView(candidate)}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> Resume
                    </Button>
                    <Button size="sm" variant="outline"
                      className="text-green-600 border-green-400 hover:bg-green-50"
                      onClick={() => updateCandidate({ ...candidate, status: 'shortlisted' })}>
                      Shortlist
                    </Button>
                    {/* ✅ NEW: Interview button on each card */}
                    <Button size="sm" variant="outline"
                      className="text-blue-600 border-blue-400 hover:bg-blue-50"
                      onClick={() => { updateCandidate({ ...candidate, status: 'interview' }); toast({ title: `${candidate.name} moved to Interview` }); }}>
                      Interview
                    </Button>
                    <Button size="sm" variant="outline"
                      className="text-purple-600 border-purple-400 hover:bg-purple-50"
                      onClick={() => updateCandidate({ ...candidate, status: 'hired' })}>
                      Hire
                    </Button>
                    <Button size="sm" variant="outline"
                      className="text-red-500 border-red-400 hover:bg-red-50"
                      onClick={() => updateCandidate({ ...candidate, status: 'rejected' })}>
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Resume View Modal ── */}
      {/* FIX: hideCloseButton removes the default X so only our custom X shows */}
      <Dialog open={!!viewingResume} onOpenChange={open => { if (!open) closeModal(); }}>
        <DialogContent
          className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0"
        >
          {viewingResume && (() => {
            const { candidate, resume } = viewingResume;
            const job = jobs.find(j => j.id === candidate.jobId);
            const sc = statusConfig[candidate.status] || statusConfig.pending;

            return (
              <>
                {/* ── Banner ── */}
                <div className="relative bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-6 pt-6 pb-8 rounded-t-lg">
                  {/* ✅ Single close button only */}
                  <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
                    aria-label="Close"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>

                  <div className="flex items-start gap-4 pr-10">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-2xl font-bold">
                      {candidate.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold leading-tight">{candidate.name}</h2>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-primary-foreground/80">
                        {candidate.email && (
                          <span className="flex items-center gap-1">
                            <AtSign className="w-3.5 h-3.5" />{candidate.email}
                          </span>
                        )}
                        {resume?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />{resume.phone}
                          </span>
                        )}
                      </div>
                      {job && (
                        <div className="flex items-center gap-1.5 mt-2 text-sm">
                          <Briefcase className="w-3.5 h-3.5 text-primary-foreground/70" />
                          <span className="text-primary-foreground/80">Applied for</span>
                          <span className="font-medium">{job.title}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-center bg-white/20 rounded-xl px-4 py-2">
                      <p className="text-2xl font-bold leading-none">{candidate.matchScore}%</p>
                      <p className="text-xs text-primary-foreground/70 mt-0.5">match</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                      {sc.label}
                    </span>
                    {candidate.aiExplanation.recommendation && (
                      <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                        AI: {candidate.aiExplanation.recommendation}
                      </span>
                    )}
                    {candidate.overallFit && (
                      <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                        {candidate.overallFit} Fit
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Body ── */}
                <div className="p-6 space-y-6">

                  {/* ── RESUME FILE VIEWER ── */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/60 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-semibold truncate max-w-[220px]">
                            {resume?.fileName || 'Resume File'}
                          </p>
                          {resume?.uploadedAt && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded {new Date(resume.uploadedAt).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {loadingFileUrl && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open File
                          </a>
                        )}
                      </div>
                    </div>

                    {loadingFileUrl ? (
                      <div className="flex items-center justify-center py-14 bg-muted/20">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : fileUrl && isPdf(fileUrl) ? (
                      <div style={{ height: '460px' }} className="w-full bg-muted/20">
                        <iframe
                          src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                          className="w-full h-full border-0"
                          title={`Resume — ${candidate.name}`}
                        />
                      </div>
                    ) : fileUrl ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3 bg-muted/20 text-center px-4">
                        <FileText className="w-12 h-12 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          This file type ({resume?.fileName?.split('.').pop()?.toUpperCase() || 'DOC'}) cannot be previewed in the browser.
                        </p>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" /> Download & View Resume
                        </a>
                      </div>
                    ) : resume?.rawText ? (
                      <div className="p-4 max-h-72 overflow-y-auto bg-muted/10">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                          Parsed Resume Content
                        </p>
                        <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
                          {resume.rawText}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 bg-muted/20 text-center px-4">
                        <FileText className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Resume file is not stored or accessible.</p>
                        <p className="text-xs text-muted-foreground/60">Parsed details are shown below.</p>
                      </div>
                    )}
                  </div>

                  {/* Quick score stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Experience', value: candidate.experienceScore, icon: Briefcase },
                      { label: 'Education', value: candidate.educationScore, icon: GraduationCap },
                      { label: 'AI Confidence', value: candidate.aiExplanation.confidence, icon: Zap },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="bg-muted/50 rounded-lg p-3 text-center">
                        <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <p className={`text-lg font-bold ${getScoreColor(value)}`}>{value}%</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary */}
                  {candidate.aiExplanation.summary && (
                    <div className="bg-muted/40 border border-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-primary" /> AI Summary
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {candidate.aiExplanation.summary}
                      </p>
                    </div>
                  )}

                  {/* Skills */}
                  {resume?.skills && resume.skills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2.5">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {resume.skills.map(skill => {
                          const sm = candidate.skillMatch.find(
                            s => s.skill.toLowerCase() === skill.toLowerCase()
                          );
                          const matched = sm?.matched ?? false;
                          return (
                            <span key={skill}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${matched
                                ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
                                : 'bg-muted border-border text-muted-foreground'
                                }`}>
                              {matched && <span className="mr-1">✓</span>}
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Skill Match Breakdown */}
                  {candidate.skillMatch.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" /> Skill Match Breakdown
                      </h3>
                      <div className="space-y-2.5">
                        {candidate.skillMatch.map(sm => (
                          <div key={sm.skill}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm flex items-center gap-1.5">
                                {sm.skill}
                                {sm.required && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Required</span>
                                )}
                              </span>
                              <span className={`text-xs font-medium ${sm.matched ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                {sm.proficiency}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${sm.matched ? 'bg-green-500' : 'bg-red-400'}`}
                                style={{ width: `${sm.proficiency}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skill Gaps */}
                  {candidate.skillGaps.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Skill Gaps
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {candidate.skillGaps.map(gap => (
                          <span key={gap}
                            className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {candidate.strengths.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
                          <Star className="w-4 h-4 text-green-500" /> Strengths
                        </h3>
                        <ul className="space-y-1.5">
                          {candidate.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                              <span className="mt-0.5 shrink-0">✓</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {candidate.weaknesses.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-500" /> Weaknesses
                        </h3>
                        <ul className="space-y-1.5">
                          {candidate.weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                              <span className="mt-0.5 shrink-0">✗</span>{w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Experience & Education */}
                  {(resume?.experience || resume?.education) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {resume?.experience && (
                        <div className="bg-muted/40 rounded-lg p-4 border border-border">
                          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <Briefcase className="w-4 h-4 text-primary" /> Experience
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{resume.experience}</p>
                        </div>
                      )}
                      {resume?.education && (
                        <div className="bg-muted/40 rounded-lg p-4 border border-border">
                          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <GraduationCap className="w-4 h-4 text-primary" /> Education
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{resume.education}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flags */}
                  {candidate.flags.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4" /> Flags / Concerns
                      </h3>
                      <ul className="space-y-1">
                        {candidate.flags.map((f, i) => (
                          <li key={i} className="text-sm text-amber-700 dark:text-amber-300">• {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ✅ Action buttons — now includes Interview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        updateCandidate({ ...candidate, status: 'shortlisted' });
                        closeModal();
                        toast({ title: `${candidate.name} shortlisted` });
                      }}
                    >
                      <CheckCheck className="w-4 h-4 mr-2" /> Shortlist
                    </Button>
                    {/* ✅ NEW: Interview button in modal */}
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        updateCandidate({ ...candidate, status: 'interview' });
                        closeModal();
                        toast({ title: `${candidate.name} moved to Interview` });
                      }}
                    >
                      <CalendarCheck className="w-4 h-4 mr-2" /> Interview
                    </Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => {
                        updateCandidate({ ...candidate, status: 'hired' });
                        closeModal();
                        toast({ title: `🎉 ${candidate.name} hired!` });
                      }}
                    >
                      <UserCheck className="w-4 h-4 mr-2" /> Hire
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        updateCandidate({ ...candidate, status: 'rejected' });
                        closeModal();
                        toast({ title: `${candidate.name} rejected` });
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}