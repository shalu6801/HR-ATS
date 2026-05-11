import { useATS } from '@/contexts/ATSContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function useThemeColors() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    blue: dark ? '#85B7EB' : '#378ADD',
    pink: dark ? '#ED93B1' : '#D4537E',
    teal: dark ? '#5DCAA5' : '#1D9E75',
    amber: dark ? '#EF9F27' : '#BA7517',
    purple: dark ? '#AFA9EC' : '#7F77DD',
    coral: dark ? '#F0997B' : '#D85A30',
    tick: dark ? '#888780' : '#888780',
  };
}

// Safely extract month (0-11) from any date value
function safeGetMonth(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const parsed = d instanceof Date ? d : new Date(d);
  if (isNaN(parsed.getTime())) return null;
  return parsed.getMonth();
}

function countByMonth(dates: (Date | string | null | undefined)[]): Record<number, number> {
  const counts: Record<number, number> = {};
  dates.forEach(d => {
    const m = safeGetMonth(d);
    if (m === null) return;
    counts[m] = (counts[m] || 0) + 1;
  });
  return counts;
}

export default function ReportsPage() {
  const { candidates, resumes, jobs } = useATS();
  const C = useThemeColors();

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: '0.5px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
  };

  const shortlisted = candidates.filter(c => c.status === 'shortlisted').length;
  const rejected = candidates.filter(c => c.status === 'rejected').length;
  const interview = candidates.filter(c => c.status === 'interview').length;
  const hired = candidates.filter(c => c.status === 'hired').length;
  const pending = candidates.filter(c => c.status === 'pending').length;
  const hireRate = resumes.length > 0 ? Math.round(hired / resumes.length * 100) : 0;

  // Count resumes by the month they were uploaded
  const resumesByMonth = countByMonth(resumes.map(r => r.uploadedAt));

  // Count shortlisted candidates by their shortlistedAt date only (no fallback)
  const shortlistedByMonth = countByMonth(
    candidates
      .filter(c => c.status === "shortlisted")
      .map(c => c.shortlistedAt ? new Date(c.shortlistedAt) : null)
  );

  // Count hired candidates by their hiredAt date only (no fallback)
  const hiredByMonth = countByMonth(
    candidates
      .filter(c => c.status === "hired")
      .map(c => c.hiredAt ? new Date(c.hiredAt) : null)
  );

  const currentMonth = new Date().getMonth();

  const funnelTrendData = MONTH_LABELS.map((month, i) => {
    // Future months: return null so line doesn't extend there
    if (i > currentMonth) {
      return { month, Applied: null, Shortlisted: null, Hired: null };
    }
    return {
      month,
      Applied: resumesByMonth[i] ?? 0,
      Shortlisted: shortlistedByMonth[i] ?? 0,
      Hired: hiredByMonth[i] ?? 0,
    };
  });

  const hasLineData = Object.values(resumesByMonth).some(v => v > 0);

  // Calculate proper Y-axis max so chart doesn't render inverted
  const allValues = funnelTrendData.flatMap(d => [
    d.Applied ?? 0,
    d.Shortlisted ?? 0,
    d.Hired ?? 0,
  ]);
  const yMax = Math.max(...allValues, 1);
  const yDomainMax = Math.ceil(yMax / 10) * 10 || 10;

  const statusData = [
    { name: 'Pending', value: pending, color: C.amber },
    { name: 'Shortlisted', value: shortlisted, color: C.teal },
    { name: 'Rejected', value: rejected, color: C.coral },
    { name: 'Interview', value: interview, color: C.blue },
    { name: 'Hired', value: hired, color: C.purple },
  ].filter(d => d.value > 0);

  const skillCounts: Record<string, number> = {};
  jobs.forEach(j => j.skills.forEach(s => {
    skillCounts[s] = (skillCounts[s] || 0) + 1;
  }));
  const skillData = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill, count]) => ({ skill, count }));

  const jobScores = jobs
    .map(j => {
      const jc = candidates.filter(c => c.jobId === j.id);
      const avg = jc.length
        ? Math.round(jc.reduce((s, c) => s + c.matchScore, 0) / jc.length)
        : 0;
      return {
        job: j.title.length > 13 ? j.title.slice(0, 13) + '…' : j.title,
        avgScore: avg,
        count: jc.length,
      };
    })
    .filter(j => j.count > 0);

  const kpis = [
    { label: 'Total resumes', val: resumes.length, sub: 'uploaded' },
    { label: 'Candidates', val: candidates.length, sub: 'screened' },
    {
      label: 'Shortlisted',
      val: shortlisted,
      sub: candidates.length > 0
        ? `${Math.round(shortlisted / candidates.length * 100)}% conversion`
        : '—',
    },
    { label: 'Hired', val: hired, sub: `${hireRate}% of applied` },
  ];

  const hasData = resumes.length > 0 || candidates.length > 0;

  return (
    <div className="p-6 space-y-5">

      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Hiring insights and pipeline metrics
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div
            key={k.label}
            className="bg-secondary rounded-lg p-4 flex flex-col gap-1"
          >
            <span className="text-xs text-muted-foreground">{k.label}</span>
            <span className="text-2xl font-medium leading-none">{k.val}</span>
            <span className="text-xs text-muted-foreground/60">{k.sub}</span>
          </div>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No data yet. Upload resumes and screen candidates to generate reports.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Monthly additions line chart ── */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-0 pt-5 px-5">
              <p className="text-xs text-muted-foreground">Monthly new additions</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-xl font-medium">
                  {resumes.length} Total Resumes
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
                  {hireRate}% hire rate
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-3 px-2 pb-4">
              <div className="flex flex-wrap gap-3 px-3 mb-3">
                {[
                  { label: 'Applied', color: C.blue },
                  { label: 'Shortlisted', color: C.teal },
                  { label: 'Hired', color: C.amber },
                ].map(l => (
                  <span
                    key={l.label}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: l.color }}
                    />
                    {l.label}
                  </span>
                ))}
              </div>

              {hasLineData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={funnelTrendData}
                    margin={{ left: -10, right: 16, top: 8, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="month"
                      tick={{ fill: C.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: C.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      domain={[0, yDomainMax]}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{
                        color: 'hsl(var(--muted-foreground))',
                        marginBottom: 4,
                        fontSize: 11,
                      }}
                      itemStyle={{ fontSize: 12 }}
                      formatter={(v: number, n: string) => [v, n]}
                    />
                    <Line
                      type="monotone"
                      dataKey="Applied"
                      stroke={C.blue}
                      strokeWidth={2}
                      dot={{ r: 3, fill: C.blue, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Shortlisted"
                      stroke={C.teal}
                      strokeWidth={2}
                      dot={{ r: 3, fill: C.teal, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Hired"
                      stroke={C.amber}
                      strokeWidth={2}
                      dot={{ r: 3, fill: C.amber, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                  Upload resumes to see monthly trend
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Candidate status donut ── */}
          <Card>
            <CardHeader className="pb-0 pt-5 px-5">
              <p className="text-xs text-muted-foreground font-medium">
                Candidate status
              </p>
            </CardHeader>
            <CardContent className="pt-3 px-5 pb-5">
              {statusData.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                    {statusData.map(s => (
                      <span
                        key={s.name}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span
                          className="w-2 h-2 rounded-sm inline-block"
                          style={{ background: s.color }}
                        />
                        {s.name}{' '}
                        <span className="font-medium text-foreground">
                          {s.value}
                        </span>
                      </span>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        dataKey="value"
                        strokeWidth={0}
                        paddingAngle={2}
                      >
                        {statusData.map((s, i) => (
                          <Cell key={i} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number, n: string) => [v, n]}
                        itemStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No candidates yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Skill demand horizontal bar ── */}
          <Card>
            <CardHeader className="pb-0 pt-5 px-5">
              <p className="text-xs text-muted-foreground font-medium">
                Skill demand across jobs
              </p>
            </CardHeader>
            <CardContent className="pt-3 px-2 pb-4">
              {skillData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(skillData.length * 36 + 24, 190)}
                >
                  <BarChart
                    data={skillData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: C.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="skill"
                      type="category"
                      width={68}
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [v, 'Jobs requiring']}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="count"
                      fill={C.teal}
                      radius={[0, 4, 4, 0]}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Create jobs to see skill demand
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Avg match score per job ── */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-0 pt-5 px-5">
              <p className="text-xs text-muted-foreground font-medium">
                Avg match score by job
              </p>
            </CardHeader>
            <CardContent className="pt-3 px-2 pb-4">
              {jobScores.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={jobScores}
                    margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
                  >
                    <XAxis
                      dataKey="job"
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: C.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}%`}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [`${v}%`, 'Avg match score']}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="avgScore"
                      fill={C.purple}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={52}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Screen candidates to see match scores
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}