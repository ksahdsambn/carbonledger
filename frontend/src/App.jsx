// Application shell: hash router over the nine pages (PRD 9.1).
import React, { useEffect, useState } from 'react';
import { Nav, P1Home, P2Upload, P3Records, P4Matching, P5Dashboard, P6Scenarios, P7Report, P8Review, P9Traces } from './pages.jsx';

export default function App() {
  const [taskId, setTaskId] = useState(localStorage.getItem('cl_task') ?? null);
  const [route, setRoute] = useState(location.hash.replace(/^#\/?/, '').split('?')[0] || '');
  useEffect(() => {
    const onHash = () => setRoute(location.hash.replace(/^#\/?/, '').split('?')[0]);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const chooseTask = (id) => { setTaskId(id); localStorage.setItem('cl_task', id); };
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  let page = <P1Home onTask={chooseTask} />;
  if (taskId) {
    const map = {
      upload: <P2Upload taskId={taskId} onProgress={() => {}} />,
      records: <P3Records taskId={taskId} />,
      match: <P4Matching taskId={taskId} params={params} />,
      dashboard: <P5Dashboard taskId={taskId} />,
      scenarios: <P6Scenarios taskId={taskId} />,
      report: <P7Report taskId={taskId} />,
      review: <P8Review taskId={taskId} />,
      traces: <P9Traces taskId={taskId} />,
    };
    page = map[route] ?? <P1Home onTask={chooseTask} />;
  }
  return (
    <div className="app">
      <Nav taskId={taskId} route={route} />
      {page}
      <footer className="app-footer">CarbonLedger — Sustainability &amp; Social Impact</footer>
    </div>
  );
}
