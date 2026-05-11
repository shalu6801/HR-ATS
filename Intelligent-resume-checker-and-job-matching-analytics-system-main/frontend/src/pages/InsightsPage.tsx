import { useState } from 'react';
import { useATS } from '@/contexts/ATSContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Brain, AlertTriangle, TrendingUp, Target, Search, X } from 'lucide-react';

export default function InsightsPage() {
  const { candidates, jobs } = useATS();
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const candidate = candidates.find(c => c.id === selectedCandidate);

  // Filter candidates by search query
  const filteredCandidates = candidates.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      jobs.find(j => j.id === c.jobId)?.title?.toLowerCase().includes(q) ||
      c.overallFit?.toLowerCase().includes(q) ||
      c.aiExplanation?.recommendation?.toLowerCase().includes(q)
    );
  });

  const handleCandidateSelect = (id: string) => {
    setSelectedCandidate(id);
    setSearchQuery('');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidate Insights</h1>
        <p className="text-muted-foreground">AI-powered deep analysis of candidate profiles</p>
      </div>

      {/* Candidate selector with search */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl">
        {/* Search bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search candidate by name, email, job..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown to select candidate */}
        <Select value={selectedCandidate} onValueChange={handleCandidateSelect}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Select a candidate" />
          </SelectTrigger>
          <SelectContent>
            {filteredCandidates.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No candidates found</div>
            ) : (
              filteredCandidates.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.matchScore}%
                  {jobs.find(j => j.id === c.jobId)?.title
                    ? ` · ${jobs.find(j => j.id === c.jobId)?.title}`
                    : ''}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Search results quick-select list */}
      {searchQuery && filteredCandidates.length > 0 && !selectedCandidate && (
        <Card className="max-w-2xl">
          <CardContent className="py-3 px-4 space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              {filteredCandidates.length} candidate(s) found — click to select
            </p>
            {filteredCandidates.slice(0, 8).map(c => {
              const job = jobs.find(j => j.id === c.jobId);
              return (
                <button
                  key={c.id}
                  onClick={() => handleCandidateSelect(c.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/60 transition-colors text-left gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.email}{job ? ` · ${job.title}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-primary">{c.matchScore}%</span>
                    {c.aiExplanation?.recommendation && (
                      <Badge variant="secondary" className="text-xs">
                        {c.aiExplanation.recommendation}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!candidate ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {candidates.length === 0
              ? 'No candidates yet. Screen resumes first.'
              : 'Select a candidate to view AI insights.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selected candidate banner */}
          <div className="lg:col-span-2 flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {candidate.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{candidate.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {candidate.email}
                {jobs.find(j => j.id === candidate.jobId)?.title
                  ? ` · ${jobs.find(j => j.id === candidate.jobId)?.title}`
                  : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-primary">{candidate.matchScore}%</p>
              <p className="text-xs text-muted-foreground">match</p>
            </div>
            <button
              onClick={() => setSelectedCandidate('')}
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-4 h-4" /> Skill Match Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidate.skillMatch.length > 0 ? candidate.skillMatch.map(sm => (
                <div key={sm.skill}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{sm.skill} {sm.required && <Badge variant="secondary" className="ml-1 text-[10px]">Required</Badge>}</span>
                    <span className={sm.matched ? 'text-[hsl(142,71%,45%)]' : 'text-destructive'}>{sm.proficiency}%</span>
                  </div>
                  <Progress value={sm.proficiency} className="h-2" />
                </div>
              )) : <p className="text-sm text-muted-foreground">No skill data available.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4" /> Skill Gap Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.skillGaps.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {candidate.skillGaps.map(g => (
                    <Badge key={g} variant="outline" className="border-destructive text-destructive">{g}</Badge>
                  ))}
                </div>
              ) : <p className="text-sm text-[hsl(142,71%,45%)]">No skill gaps identified!</p>}

              {candidate.flags.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 text-[hsl(38,92%,50%)]">⚠️ Inconsistency Alerts</p>
                  <ul className="space-y-1 text-sm">
                    {candidate.flags.map((f, i) => <li key={i} className="text-[hsl(38,92%,50%)]">• {f}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4" /> Strengths & Weaknesses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Strengths</p>
                  <ul className="space-y-1">{candidate.strengths.map((s, i) => <li key={i} className="text-sm text-[hsl(142,71%,45%)]">✓ {s}</li>)}</ul>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Weaknesses</p>
                  <ul className="space-y-1">{candidate.weaknesses.map((w, i) => <li key={i} className="text-sm text-destructive">✗ {w}</li>)}</ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="w-4 h-4" /> AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{candidate.aiExplanation.summary || 'No AI summary available.'}</p>
              <div className="mt-4 flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-lg font-bold">{candidate.aiExplanation.confidence}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recommendation</p>
                  <Badge variant={candidate.aiExplanation.recommendation === 'Shortlist' ? 'default' : 'secondary'}>
                    {candidate.aiExplanation.recommendation || 'N/A'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}