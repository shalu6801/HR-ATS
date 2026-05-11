import { useState, useEffect } from 'react';
import { useATS } from '@/contexts/ATSContext';
import { Job } from '@/types/ats';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const defaultResponsibilities = `* Develop and maintain applications
* Collaborate with team members
* Troubleshoot issues
* Improve system performance`;

const emptyForm = {
  title: '',
  department: '',
  description: '',
  requirements: '',
  responsibilities: '',
  experienceLevel: 'fresher' as Job['experienceLevel'],
  salaryMin: '',
  salaryMax: '',
  jobType: 'full-time' as Job['jobType'],
  skills: '',
  status: 'active' as Job['status'],
};

export default function JobsPage() {
  const { jobs, addJob, updateJob, deleteJob, setJobs } = useATS();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data, error } = await supabase.from('jobs').select('*');
    if (error) { console.error('Error fetching jobs:', error); return; }
    const fetched: Job[] = (data ?? []).map((job: any) => ({
      id: job.id,
      title: job.title,
      department: job.department || '',
      description: job.description || '',
      requirements: job.requirements || '',
      responsibilities: job.responsibilities || '',
      experienceLevel: job.experience_level || 'fresher',
      salaryMin: job.salary_min || '',
      salaryMax: job.salary_max || '',
      jobType: job.job_type || 'full-time',
      skills: job.skills || [],
      status: job.status || 'active',
      createdAt: new Date(job.created_at),
    }));
    setJobs(fetched);
  };

  const resetForm = () => { setForm(emptyForm); setEditing(null); };

  const openEdit = (job: Job) => {
    setEditing(job);
    setForm({
      title: job.title,
      department: job.department,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      jobType: job.jobType,
      skills: job.skills.join(', '),
      status: job.status,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const jobData: Job = {
      id: editing?.id || crypto.randomUUID(),
      title: form.title,
      department: form.department,
      description: form.description,
      requirements: form.requirements,
      responsibilities: form.responsibilities,
      experienceLevel: form.experienceLevel,
      salaryMin: form.salaryMin,
      salaryMax: form.salaryMax,
      jobType: form.jobType,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      status: form.status,
      createdAt: editing?.createdAt || new Date(),
    };

    const dbPayload = {
      title: jobData.title,
      department: jobData.department,
      description: jobData.description,
      requirements: jobData.requirements,
      responsibilities: jobData.responsibilities,
      experience_level: jobData.experienceLevel,
      salary_min: jobData.salaryMin,
      salary_max: jobData.salaryMax,
      job_type: jobData.jobType,
      skills: jobData.skills,
      status: jobData.status,
    };

    if (editing) {
      await supabase.from('jobs').update(dbPayload).eq('id', editing.id);
      updateJob(jobData);
    } else {
      const { error } = await supabase.from('jobs').insert({
        id: jobData.id,
        ...dbPayload,
        created_at: new Date(),
      });
      if (error) console.error(error);
      addJob(jobData);
    }
    setOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id);
    deleteJob(id);
  };

  const f = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const statusColor: Record<string, string> = {
    active: 'bg-[hsl(142,71%,45%)] text-white',
    draft: 'bg-secondary text-secondary-foreground',
    closed: 'bg-muted text-muted-foreground',
  };

  const jobTypeLabel: Record<string, string> = {
    'full-time': 'Full-time',
    'part-time': 'Part-time',
    'internship': 'Internship',
    'remote': 'Remote',
  };

  const expLabel: Record<string, string> = {
    'fresher': 'Fresher',
    '1-3 years': '1–3 Yrs',
    '3-5 years': '3–5 Yrs',
    'senior': 'Senior',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Management</h1>
          <p className="text-muted-foreground">Create and manage job postings</p>
        </div>

        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Job</Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Job' : 'Create New Job'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">

              {/* 1. Title & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={f('title')} placeholder="e.g. Frontend Developer" required />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={form.department} onChange={f('department')} placeholder="e.g. Engineering" required />
                </div>
              </div>

              {/* 2. Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={f('description')} rows={3} placeholder="Brief overview of the role..." required />
              </div>

              {/* 3. Requirements */}
              <div className="space-y-2">
                <Label>Requirements</Label>
                <Textarea value={form.requirements} onChange={f('requirements')} rows={2} placeholder="e.g. Bachelor's degree in CS..." />
              </div>

              {/* 4. Responsibilities */}
              <div className="space-y-2">
                <Label>Responsibilities</Label>
                <Textarea
                  value={form.responsibilities}
                  onChange={f('responsibilities')}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">Use * at the start of each line for bullet points</p>
              </div>

              {/* 5. Experience Level & Job Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <Select
                    value={form.experienceLevel}
                    onValueChange={v => setForm(p => ({ ...p, experienceLevel: v as Job['experienceLevel'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fresher">Fresher</SelectItem>
                      <SelectItem value="1-3 years">1–3 Years</SelectItem>
                      <SelectItem value="3-5 years">3–5 Years</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Job Type</Label>
                  <Select
                    value={form.jobType}
                    onValueChange={v => setForm(p => ({ ...p, jobType: v as Job['jobType'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 6. Salary Range */}
              <div className="space-y-2">
                <Label>Salary Range (per year)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input className="pl-7" value={form.salaryMin} onChange={f('salaryMin')} placeholder="3,00,000" />
                  </div>
                  <span className="text-muted-foreground font-medium">–</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input className="pl-7" value={form.salaryMax} onChange={f('salaryMax')} placeholder="6,00,000" />
                  </div>
                </div>
              </div>

              {/* 7. Skills */}
              <div className="space-y-2">
                <Label>Skills (comma-separated)</Label>
                <Input value={form.skills} onChange={f('skills')} placeholder="React, TypeScript, Node.js" required />
              </div>

              {/* 8. Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as Job['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={handleSubmit}>{editing ? 'Update Job' : 'Create Job'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No job postings yet. Create your first job to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>{job.department}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{jobTypeLabel[job.jobType] || job.jobType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{expLabel[job.experienceLevel] || job.experienceLevel}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {job.salaryMin && job.salaryMax ? `₹${job.salaryMin} – ₹${job.salaryMax}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {job.skills.slice(0, 3).map(s => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                      {job.skills.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{job.skills.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[job.status]}>{job.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(job)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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