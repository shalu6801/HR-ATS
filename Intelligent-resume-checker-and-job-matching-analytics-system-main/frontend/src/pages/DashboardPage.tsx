import { useATS } from '@/contexts/ATSContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Briefcase, Trophy, Clock, Plus, Upload, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { resumes, candidates, jobs, activities } = useATS();
  const navigate = useNavigate();

  const shortlisted = candidates.filter(c => c.status === 'shortlisted').length;
  const rejected = candidates.filter(c => c.status === 'rejected').length;
  const pending = candidates.filter(c => c.status === 'pending').length;

  // KPI cards — clicking shortlisted/rejected/pending navigates to ranking with filter
  const kpis = [
    {
      label: 'Total Resumes',
      value: resumes.length,
      icon: FileText,
      color: 'text-primary',
      onClick: () => navigate('/screening'),
    },
    {
      label: 'Shortlisted',
      value: shortlisted,
      icon: Trophy,
      color: 'text-[hsl(142,71%,45%)]',
      onClick: () => navigate('/ranking?filter=shortlisted'),
    },
    {
      label: 'Rejected',
      value: rejected,
      icon: Clock,
      color: 'text-destructive',
      onClick: () => navigate('/ranking?filter=rejected'),
    },
    {
      label: 'Pending Review',
      value: pending,
      icon: Clock,
      color: 'text-[hsl(38,92%,50%)]',
      onClick: () => navigate('/ranking?filter=pending'),
    },
  ];

  const chartData = [
    { name: 'Applied', value: resumes.length },
    { name: 'Screened', value: candidates.length },
    { name: 'Shortlisted', value: shortlisted },
    { name: 'Hired', value: candidates.filter(c => c.status === 'hired').length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HR Dashboard</h1>
          <p className="text-muted-foreground">Overview of your recruitment pipeline</p>
        </div>
      </div>

      {/* KPI Cards — clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card
            key={kpi.label}
            className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
            onClick={kpi.onClick}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 opacity-70">
                    Click to view →
                  </p>

                </div>
                <kpi.icon className={`w-10 h-10 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => navigate('/screening')}>
          <Upload className="w-4 h-4 mr-2" /> Upload Resumes
        </Button>
        <Button variant="outline" onClick={() => navigate('/jobs')}>
          <Plus className="w-4 h-4 mr-2" /> Create Job
        </Button>
        <Button variant="outline" onClick={() => navigate('/ranking')}>
          <Trophy className="w-4 h-4 mr-2" /> View Rankings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" /> Hiring Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(217, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet. Start by creating a job posting or uploading resumes.</p>
            ) : (
              <ul className="space-y-3 max-h-52 overflow-y-auto">
                {activities.slice(0, 10).map(a => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-foreground">{a.message}</p>
                      <p className="text-muted-foreground text-xs">
                        {a.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}