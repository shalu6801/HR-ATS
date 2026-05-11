import { useState, useRef } from 'react';
import { useATS } from '@/contexts/ATSContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Send, Paperclip, X, FileText, Upload, Search, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import emailjs from '@emailjs/browser';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// ─── EmailJS Config ───────────────────────────────────────────────────────────
// Set these in your .env file:
//   VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
//   VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
//   VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

console.log("SERVICE ID:", EMAILJS_SERVICE_ID);
console.log("TEMPLATE ID:", EMAILJS_TEMPLATE_ID);
console.log("PUBLIC KEY:", EMAILJS_PUBLIC_KEY);

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  base64: string;
  file: File;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const templateTypeToStatus: Record<string, string | null> = {
  shortlist: 'shortlisted',
  rejection: 'rejected',
  interview: 'interview',
  offer: 'hired',
};

const statusBadgeStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  shortlisted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  interview: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  hired: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function EmailPage() {
  const { candidates, emailTemplates, emailRecords, addEmailRecord, jobs } = useATS();
  const { toast } = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [rawSubject, setRawSubject] = useState('');
  const [rawBody, setRawBody] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmailJSConfigured =
    EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY;

  const template = emailTemplates.find(t => t.id === selectedTemplate);
  const isOfferLetterTemplate =
    template?.type === 'offer' || template?.name?.toLowerCase().includes('offer');

  const templateStatusFilter = template
    ? (templateTypeToStatus[template.type] ?? null)
    : null;

  const previewCandidate = selectedCandidates.length > 0
    ? candidates.find(c => c.id === selectedCandidates[0])
    : null;

  const resolvePlaceholders = (text: string, candidateId?: string) => {
    const c = candidateId
      ? candidates.find(x => x.id === candidateId)
      : previewCandidate;
    if (!c) return text;
    const job = jobs.find(j => j.id === c.jobId);
    return text
      .replace(/\{\{candidateName\}\}/g, c.name)
      .replace(/\{\{jobTitle\}\}/g, job?.title || '');
  };

  const previewSubject = previewCandidate ? resolvePlaceholders(rawSubject) : rawSubject;
  const previewBody = previewCandidate ? resolvePlaceholders(rawBody) : rawBody;

  const handleTemplateChange = (id: string) => {
    setSelectedTemplate(id);
    const tmpl = emailTemplates.find(t => t.id === id);
    if (tmpl) { setRawSubject(tmpl.subject); setRawBody(tmpl.body); }
    setAttachedFiles([]);
    setSelectedCandidates([]);
    setCandidateSearch('');
  };

  const statusFilteredCandidates = candidates.filter(c =>
    templateStatusFilter ? c.status === templateStatusFilter : true
  );

  const filteredCandidates = statusFilteredCandidates.filter(c => {
    if (!candidateSearch.trim()) return true;
    const q = candidateSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      jobs.find(j => j.id === c.jobId)?.title?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    );
  });

  const toggleCandidate = (id: string) =>
    setSelectedCandidates(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );

  const handleSelectAll = () => {
    const allIds = filteredCandidates.map(c => c.id);
    const allSelected = allIds.every(id => selectedCandidates.includes(id));
    if (allSelected) {
      setSelectedCandidates(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedCandidates(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsProcessingFile(true);
    const newFiles: AttachedFile[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File Too Large', description: `${file.name} — max 5MB.`, variant: 'destructive' });
        continue;
      }
      const allowed = [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png',
      ];
      if (!allowed.includes(file.type)) {
        toast({ title: 'Invalid Type', description: `${file.name}: Only PDF, DOC, DOCX, JPG, PNG.`, variant: 'destructive' });
        continue;
      }
      const base64 = await fileToBase64(file);
      newFiles.push({ name: file.name, size: file.size, type: file.type, base64, file });
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length) toast({ title: 'File Attached', description: `${newFiles.length} file(s) ready.` });
    setIsProcessingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) =>
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));

  // ─── Send via EmailJS ─────────────────────────────────────────────────────
  const sendEmails = async () => {
    if (!selectedCandidates.length) {
      toast({ title: 'Select candidates', description: 'Please select at least one candidate.', variant: 'destructive' });
      return;
    }
    if (!isEmailJSConfigured) {
      toast({
        title: 'EmailJS Not Configured',
        description: 'Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY to your .env file.',
        variant: 'destructive',
      });
      return;
    }
    if (isOfferLetterTemplate && !attachedFiles.length) {
      toast({ title: 'Attachment Required', description: 'Please attach the offer letter before sending.', variant: 'destructive' });
      return;
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const cid of selectedCandidates) {
      const c = candidates.find(x => x.id === cid);
      if (!c) continue;

      const finalSubject = resolvePlaceholders(rawSubject, cid);
      const finalBody = resolvePlaceholders(rawBody, cid);

      let fileUrl = null;

      if (attachedFiles.length > 0) {
        const file = attachedFiles[0].file;

        const fileName = `${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
          .from("offers")
          .upload(fileName, file);

        if (!error) {
          const { data } = supabase.storage
            .from("offers")
            .getPublicUrl(fileName);

          fileUrl = data.publicUrl;
        }
      }

      try {
        // EmailJS template params — match these to your EmailJS template variables
        const finalMessage = fileUrl
          ? `${finalBody}\n\nDownload your offer letter:\n${fileUrl}`
          : finalBody;

        const templateParams = {
          to_email: c.email,
          to_name: c.name,
          from_name: 'TalentAI HR Team',
          subject: finalSubject,
          message: `<div style="white-space: pre-line;">${finalMessage}</div>`,
          reply_to: '', // optional
        };

        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams,
          EMAILJS_PUBLIC_KEY,
        );

        successCount++;
        addEmailRecord({
          id: crypto.randomUUID(),
          candidateId: c.id,
          candidateName: c.name,
          templateType: template?.type || 'custom',
          subject: finalSubject,
          status: 'sent',
          sentAt: new Date(),
        });
      } catch (err: any) {
        console.error(`Email failed for ${c.name}:`, err);
        failCount++;
        toast({
          title: `Failed: ${c.name}`,
          description: err?.text || err?.message || 'Unknown error',
          variant: 'destructive',
        });
        addEmailRecord({
          id: crypto.randomUUID(),
          candidateId: c.id,
          candidateName: c.name,
          templateType: template?.type || 'custom',
          subject: finalSubject,
          status: 'failed',
          sentAt: new Date(),
        });
      }
    }

    setSending(false);
    setSelectedCandidates([]);
    if (successCount > 0) toast({ title: 'Emails Sent!', description: `${successCount} email(s) sent successfully!` });
    if (failCount > 0) toast({ title: 'Some Failed', description: `${failCount} email(s) failed.`, variant: 'destructive' });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Automation</h1>
        <p className="text-muted-foreground">Send personalised emails to candidates via EmailJS</p>
      </div>

      {/* EmailJS setup banner */}
      {!isEmailJSConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">EmailJS Setup Required</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-700 dark:text-amber-400">
              <li>Go to <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">emailjs.com</a> → Sign up free (200 emails/month)</li>
              <li>Add New Service → Connect your Gmail account</li>
              <li>Create Email Template with variables: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-xs">{"{{to_email}}, {{to_name}}, {{subject}}, {{message}}, {{from_name}}"}</code></li>
              <li>Add to your <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-xs">.env</code> file on Vercel (Environment Variables):</li>
            </ol>
            <pre className="mt-2 bg-amber-100 dark:bg-amber-900/40 rounded p-2 text-xs font-mono text-amber-900 dark:text-amber-300">
              {`VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx`}
            </pre>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Compose ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Compose Email
              {previewCandidate && (
                <Badge variant="outline" className="text-xs font-normal text-blue-600 border-blue-300 bg-blue-50">
                  Preview: {previewCandidate.name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                <SelectContent>
                  {emailTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={previewSubject}
                onChange={e => {
                  if (previewCandidate) {
                    const job = jobs.find(j => j.id === previewCandidate.jobId);
                    setRawSubject(
                      e.target.value
                        .replace(new RegExp(previewCandidate.name, 'g'), '{{candidateName}}')
                        .replace(new RegExp(job?.title || '\x00', 'g'), '{{jobTitle}}')
                    );
                  } else { setRawSubject(e.target.value); }
                }}
                placeholder="Email subject..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Body</label>
              <Textarea
                value={previewBody}
                onChange={e => {
                  if (previewCandidate) {
                    const job = jobs.find(j => j.id === previewCandidate.jobId);
                    setRawBody(
                      e.target.value
                        .replace(new RegExp(previewCandidate.name, 'g'), '{{candidateName}}')
                        .replace(new RegExp(job?.title || '\x00', 'g'), '{{jobTitle}}')
                    );
                  } else { setRawBody(e.target.value); }
                }}
                rows={8}
                placeholder="Email body..."
              />
            </div>

            {previewCandidate
              ? <p className="text-xs text-blue-500">Live preview for <strong>{previewCandidate.name}</strong>.</p>
              : <p className="text-xs text-muted-foreground">Select a candidate to see live preview.</p>
            }

            {/* Attachments (for offer letter) */}
            {isOfferLetterTemplate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachments
                    <Badge variant="destructive" className="text-xs ml-1">Required</Badge>
                  </label>
                  <Button
                    type="button" variant="outline" size="sm" className="h-7 text-xs"
                    disabled={isProcessingFile}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {isProcessingFile ? 'Processing...' : 'Attach File'}
                  </Button>
                </div>
                <input
                  ref={fileInputRef} type="file" multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden" onChange={handleFileAttach}
                />
                {attachedFiles.length > 0 ? (
                  <div className="space-y-1.5 rounded-md border p-2 bg-muted/30">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 bg-background rounded px-2 py-1.5 border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="truncate text-xs font-medium">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">({formatFileSize(file.size)})</span>
                        </div>
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="border border-dashed rounded-md p-3 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <p className="text-xs text-muted-foreground">Click to attach PDF, DOC, DOCX (max 5MB each)</p>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={sendEmails}
              className="w-full"
              disabled={sending || isProcessingFile || !isEmailJSConfigured}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending
                ? 'Sending...'
                : !isEmailJSConfigured
                  ? 'Configure EmailJS First'
                  : `Send to ${selectedCandidates.length} candidate(s)`
              }
            </Button>
          </CardContent>
        </Card>

        {/* ── Candidate Selector ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Candidates</CardTitle>
            {template && templateStatusFilter && (
              <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-primary/5 border border-primary/20">
                <span className="text-xs text-muted-foreground">Showing only</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeStyle[templateStatusFilter] || ''}`}>
                  {templateStatusFilter}
                </span>
                <span className="text-xs text-muted-foreground">candidates</span>
              </div>
            )}
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, job..."
                value={candidateSearch}
                onChange={e => setCandidateSearch(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
              />
              {candidateSearch && (
                <button
                  onClick={() => setCandidateSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {(candidateSearch || templateStatusFilter) && (
              <p className="text-xs text-muted-foreground mt-1">
                {filteredCandidates.length} of {candidates.length} candidates shown
              </p>
            )}
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates available. Screen resumes first.</p>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {templateStatusFilter
                    ? `No ${templateStatusFilter} candidates found.`
                    : 'No candidates match your search.'}
                </p>
                {templateStatusFilter && (
                  <p className="text-xs text-muted-foreground/70">
                    Go to Candidate Ranking to change candidate statuses.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-2">
                  <Checkbox
                    checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selectedCandidates.includes(c.id))}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground font-medium">
                    Select all ({filteredCandidates.length})
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {filteredCandidates.map(c => (
                    <label key={c.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selectedCandidates.includes(c.id)}
                        onCheckedChange={() => toggleCandidate(c.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.email}
                          {jobs.find(j => j.id === c.jobId)?.title ? ` · ${jobs.find(j => j.id === c.jobId)?.title}` : ''}
                          {' · '}{c.matchScore}% match
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusBadgeStyle[c.status] || 'bg-muted text-muted-foreground'}`}>
                        {c.status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Sent History ── */}
      {emailRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" /> Sent Communications
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...emailRecords].reverse().map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.candidateName}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.subject}</TableCell>
                  <TableCell><Badge variant="secondary">{r.templateType}</Badge></TableCell>
                  <TableCell>
                    <Badge className={r.status === 'sent' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.sentAt.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}