// Application shell: hash router over the task-scoped pages (PRD 9.1 P1..P9)
// plus the global factor-library and task-history views.
import React, { useEffect, useState } from 'react';
import { Nav, P1Home, P2Upload, P3Records } from './pages/core.jsx';
import { P4Matching, P5Dashboard, P6Scenarios } from './pages/analysis.jsx';
import { P7Report, P8Review, P9Traces } from './pages/report.jsx';
import { FactorsLibrary, TasksPage } from './pages/library.jsx';
import { ensureAnonymousSession } from './auth.js';

export default function App() {
  const [taskId, setTaskId] = useState(localStorage.getItem('cl_task') ?? null);
  const [identity, setIdentity] = useState('pending');
  // Track the FULL hash (path + query) so a query-only change — e.g. a
  // citation link from #/library to #/library?factor=EF-… — re-renders and
  // the target page receives fresh params.
  const [hash, setHash] = useState(location.hash || '#/');
  // Entering the site completes anonymous sign-in: no form, no credential.
  useEffect(() => {
    ensureAnonymousSession().then((uid) => setIdentity(uid ?? 'none')).catch(() => setIdentity('none'));
  }, []);
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const chooseTask = (id) => { setTaskId(id); localStorage.setItem('cl_task', id); };
  const route = hash.replace(/^#\/?/, '').split('?')[0] || '';
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const taskMap = {
    upload: <P2Upload taskId={taskId} onProgress={() => {}} chooseTaskIfSet={chooseTask} />,
    records: <P3Records taskId={taskId} params={params} />,
    match: <P4Matching taskId={taskId} params={params} />,
    dashboard: <P5Dashboard taskId={taskId} />,
    scenarios: <P6Scenarios taskId={taskId} />,
    report: <P7Report taskId={taskId} />,
    review: <P8Review taskId={taskId} />,
    traces: <P9Traces taskId={taskId} />,
  };
  // Global routes work without a task; task-scoped routes fall back to P1
  // when no task is selected yet.
  const globalMap = {
    library: <FactorsLibrary params={params} />,
    tasks: <TasksPage onTask={chooseTask} current={taskId} />,
  };
  let page;
  if (globalMap[route]) page = globalMap[route];
  else if (taskId && taskMap[route]) page = taskMap[route];
  else page = <P1Home onTask={chooseTask} />;
  return (
    <div className="app">
      <Nav taskId={taskId} route={route} onSwitchTask={chooseTask} />
      {page}
      <footer className="app-footer">
        CarbonLedger — Sustainability &amp; Social Impact
        {identity !== 'pending' && (
          <span className="anon-note"> · anonymous session{identity !== 'none' ? ` ${identity.slice(0, 6)}…` : ' unavailable'}</span>
        )}
      </footer>
    </div>
  );
}
