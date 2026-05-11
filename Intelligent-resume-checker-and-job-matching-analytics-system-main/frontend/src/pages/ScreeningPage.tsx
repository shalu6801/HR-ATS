import { useState, useEffect, useRef } from "react";
import { useATS } from "@/contexts/ATSContext";
import { Resume } from "@/types/ats";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alertdialog";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Search, X, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileStatus {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export default function ScreeningPage() {
  const { resumes, addResume, setResumes, deleteResume, jobs } = useATS();
  const { toast } = useToast();

  const [selectedJob, setSelectedJob] = useState<string>("");
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  // Single delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<Resume | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulk delete dialog
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) { console.error("Error fetching resumes:", error); return; }

    const fetched: Resume[] = (data ?? []).map((r: any) => ({
      id: r.id,
      fileName: r.file_name,
      candidateName: r.candidate_name || "",
      email: r.email || "",
      phone: r.phone || "",
      skills: r.skills || [],
      experience: "",
      education: "",
      rawText: "",
      status: "parsed" as Resume["status"],
      jobId: r.job_id || "",
      uploadedAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));

    setResumes(fetched);
  };

  const updateStatus = (name: string, status: FileStatus["status"], error?: string) => {
    setFileStatuses(prev =>
      prev.map(f => f.name === name ? { ...f, status, error } : f)
    );
  };

  const processFile = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    updateStatus(file.name, "uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      const candidateName = result?.name || file.name.replace(/\.[^.]+$/, "");
      const email = result?.email || "";
      const phone = result?.phone || "";
      const skills = result?.skills || [];

      const filePath = `${crypto.randomUUID()}-${file.name}`;
      await supabase.storage.from("resumes").upload(filePath, file);
      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(filePath);

      const resumeId = crypto.randomUUID();

      const { error: insertError } = await supabase.from("resumes").insert({
        id: resumeId,
        user_id: user.id,
        file_name: file.name,
        candidate_name: candidateName,
        email,
        phone,
        skills,
        file_url: urlData.publicUrl,
        job_id: selectedJob || null,
      });

      if (insertError) throw insertError;

      if (selectedJob) {
        const job = jobs.find(j => j.id === selectedJob);
        const aiResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/ai-analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume: JSON.stringify(result),
            job: job?.description || "",
          }),
        });
        const aiData = await aiResponse.json();
        await supabase.from("resume_analysis").insert({
          resume_id: resumeId,
          skills: aiData?.skill_match || [],
          ats_score: aiData?.score || 0,
          missing_skills: aiData?.missing_skills || [],
        });
      }

      const resume: Resume = {
        id: resumeId,
        fileName: file.name,
        candidateName,
        email,
        phone,
        skills,
        experience: "",
        education: "",
        rawText: "",
        status: "parsed",
        jobId: selectedJob,
        uploadedAt: new Date(),
      };

      addResume(resume);
      updateStatus(file.name, "done");
    } catch (err: any) {
      console.error(err);
      updateStatus(file.name, "error", err?.message || "Upload failed");
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!selectedJob) {
      alert("Please select a job first");
      return;
    }

    const fileArr = Array.from(files).filter(f =>
      f.name.match(/\.(pdf|doc|docx)$/i)
    );
    if (fileArr.length === 0) return;

    setFileStatuses(prev => [
      ...prev,
      ...fileArr.map(f => ({ name: f.name, status: "pending" as const })),
    ]);

    await Promise.all(fileArr.map(f => processFile(f)));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) handleFiles(files);
    };
    input.click();
  };

  // ── Multi-select logic ────────────────────────────────────────────────────

  const filteredResumes = resumes.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.candidateName?.toLowerCase().includes(q) ||
      r.fileName?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.skills?.some(s => s.toLowerCase().includes(q)) ||
      jobs.find(j => j.id === r.jobId)?.title?.toLowerCase().includes(q)
    );
  });

  const allSelected =
    filteredResumes.length > 0 &&
    filteredResumes.every(r => selectedIds.has(r.id));

  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      // Deselect all filtered
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredResumes.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredResumes.forEach(r => next.add(r.id));
        return next;
      });
    }
    lastClickedIndexRef.current = null;
  };

  const handleRowCheckbox = (
    e: React.MouseEvent,
    resumeId: string,
    index: number
  ) => {
    const isShift = e.shiftKey;

    if (isShift && lastClickedIndexRef.current !== null) {
      // Shift-click: select range between lastClickedIndex and current index
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangeIds = filteredResumes.slice(start, end + 1).map(r => r.id);

      // Determine whether to select or deselect based on current item state
      const shouldSelect = !selectedIds.has(resumeId);
      setSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(id => {
          if (shouldSelect) next.add(id);
          else next.delete(id);
        });
        return next;
      });
    } else {
      // Normal click: toggle single
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(resumeId)) next.delete(resumeId);
        else next.add(resumeId);
        return next;
      });
    }

    lastClickedIndexRef.current = index;
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  };

  // ── Single delete ─────────────────────────────────────────────────────────

  const handleDeleteClick = (resume: Resume) => {
    setResumeToDelete(resume);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!resumeToDelete) return;
    setDeletingId(resumeToDelete.id);
    setDeleteDialogOpen(false);

    try {
      const { error } = await supabase
        .from("resumes")
        .delete()
        .eq("id", resumeToDelete.id);

      if (error) throw error;

      deleteResume(resumeToDelete.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(resumeToDelete.id);
        return next;
      });

      toast({
        title: "Resume Deleted",
        description: `${resumeToDelete.candidateName || resumeToDelete.fileName} has been removed.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Delete Failed",
        description: err?.message || "Could not delete resume.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setResumeToDelete(null);
    }
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────

  const handleBulkDeleteConfirm = async () => {
    setBulkDeleting(true);
    setBulkDeleteDialogOpen(false);

    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of idsToDelete) {
      try {
        const { error } = await supabase.from("resumes").delete().eq("id", id);
        if (error) throw error;
        deleteResume(id);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete resume ${id}:`, err);
        failCount++;
      }
    }

    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
    setBulkDeleting(false);

    if (successCount > 0) {
      toast({
        title: `${successCount} Resume(s) Deleted`,
        description: failCount > 0 ? `${failCount} failed.` : "All selected resumes removed.",
      });
    }
    if (failCount > 0 && successCount === 0) {
      toast({ title: "Bulk Delete Failed", variant: "destructive" });
    }
  };

  const doneCount = fileStatuses.filter(f => f.status === "done").length;
  const totalCount = fileStatuses.length;
  const isProcessing = fileStatuses.some(f => f.status === "uploading" || f.status === "pending");

  const selectedInFiltered = filteredResumes.filter(r => selectedIds.has(r.id));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resume Screening</h1>
        <p className="text-muted-foreground">Upload multiple resumes and screen with AI</p>
      </div>

      {/* Job Select */}
      <div className="w-64">
        <Select value={selectedJob} onValueChange={setSelectedJob}>
          <SelectTrigger>
            <SelectValue placeholder="Select Job First" />
          </SelectTrigger>
          <SelectContent>
            {jobs.map(j => (
              <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed cursor-pointer transition-colors ${isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50"
          }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="py-12 text-center space-y-3">
          <Upload className={`w-12 h-12 mx-auto ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className="text-lg font-medium">
              {isProcessing ? "Processing resumes..." : "Drag & drop multiple resumes or click to upload"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports PDF, DOC, DOCX — select multiple files at once
            </p>
          </div>
          {!selectedJob && (
            <p className="text-sm text-destructive font-medium">⚠️ Please select a job first</p>
          )}
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {fileStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Upload Progress</span>
              <span className="text-sm font-normal text-muted-foreground">
                {doneCount}/{totalCount} completed
              </span>
            </CardTitle>
            <Progress value={totalCount > 0 ? (doneCount / totalCount) * 100 : 0} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {fileStatuses.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{f.name}</span>
                {f.status === "pending" && <span className="text-xs text-muted-foreground">Waiting...</span>}
                {f.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {f.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {f.status === "error" && (
                  <div className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-xs text-destructive">{f.error}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resumes Table */}
      {resumes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Uploaded Resumes ({resumes.length})</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, skill, email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing {filteredResumes.length} of {resumes.length} resumes
              </p>
            )}
          </CardHeader>

          {/* Bulk action bar */}
          {someSelected && (
            <div className="mx-6 mb-3 flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg flex-wrap">
              <span className="text-sm font-medium text-primary">
                {selectedIds.size} resume(s) selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={bulkDeleting}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  {bulkDeleting
                    ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    : <Trash2 className="w-4 h-4 mr-1" />
                  }
                  Delete Selected ({selectedIds.size})
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Shift-select hint */}
          <div className="mx-6 mb-2">
            <p className="text-xs text-muted-foreground">
              💡 Tip: Click a checkbox, then <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">Shift</kbd> + click another to select a range
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>File</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResumes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    No resumes match your search.
                  </td>
                </tr>
              ) : (
                filteredResumes.map((r, index) => (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer select-none transition-colors ${selectedIds.has(r.id)
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40"
                      }`}
                    onClick={(e) => {
                      // Only trigger if clicking the row itself, not the delete button
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-no-row-click]')) return;
                      handleRowCheckbox(e, r.id, index);
                    }}
                  >
                    <TableCell
                      className="w-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowCheckbox(e, r.id, index);
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={() => { }} // handled by row click
                        aria-label={`Select ${r.candidateName}`}
                      />
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate max-w-[150px]">{r.fileName}</span>
                    </TableCell>
                    <TableCell>{r.candidateName}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.phone}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {r.skills?.slice(0, 3).map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {r.skills?.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{r.skills.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{jobs.find(j => j.id === r.jobId)?.title || "—"}</TableCell>
                    <TableCell className="text-right" data-no-row-click>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(r);
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {deletingId === r.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Single Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resume?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the resume for{" "}
              <strong>{resumeToDelete?.candidateName || resumeToDelete?.fileName}</strong> and
              remove any associated candidate records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Resume(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selectedIds.size}</strong> selected resume(s)
              and all associated candidate records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}