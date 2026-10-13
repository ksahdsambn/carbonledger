// In-flight pipeline runs, keyed by task.
//
// Report generation must be single-flight per task. The report endpoint used to
// assemble a report on demand whenever none existed yet, which raced the run
// that was about to persist its own report: two reports were written 29 ms
// apart and the newer one could be assembled from a partially written ledger
// (T-050 defect report). A report request now waits for the run in flight
// instead of generating concurrently.

const inFlight = new Map();

/** Registers a running pipeline and clears the entry once it settles. */
export function trackRun(taskId, promise) {
  inFlight.set(taskId, promise);
  const clear = () => { if (inFlight.get(taskId) === promise) inFlight.delete(taskId); };
  promise.then(clear, clear);
  return promise;
}

/** The run currently processing this task, or null. */
export function waitForRun(taskId) {
  return inFlight.get(taskId) ?? null;
}

/** True while a pipeline run owns this task. */
export function isRunning(taskId) {
  return inFlight.has(taskId);
}
