export function runReport(run: any, steps: any[] = []) {
  return {
    id: String(run.id), suiteId: run.suiteId, status: run.status,
    startedAt: run.startedAt, finishedAt: run.finishedAt,
    summary: typeof run.summary === 'string' ? JSON.parse(run.summary) : run.summary,
    steps: steps.map(step => ({
      stepIndex: step.stepIndex, path: step.path, name: step.name, method: step.method,
      status: step.status, httpStatus: step.httpStatus, elapsedMs: step.elapsedMs,
      errorCode: step.errorCode,
      assertions: typeof step.assertions === 'string' ? JSON.parse(step.assertions) : step.assertions,
      extractedNames: step.extractedNames || [],
    })),
  }
}

function cell(value: unknown) {
  const text = String(value ?? '')
  const safe = /^[\s=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function reportToCsv(report: ReturnType<typeof runReport>) {
  const header = ['Step', 'Name', 'Method', 'Status', 'HTTP', 'Elapsed (ms)', 'Error', 'Assertions passed', 'Assertions failed', 'Extracted variables']
  const lines = [header.map(cell).join(',')]
  for (const step of report.steps) {
    const rules = Array.isArray(step.assertions?.rules) ? step.assertions.rules : []
    lines.push([
      step.stepIndex, step.name, step.method, step.status, step.httpStatus ?? '', step.elapsedMs,
      step.errorCode ?? '', rules.filter((rule: any) => rule.passed).length,
      rules.filter((rule: any) => !rule.passed).length, (step.extractedNames || []).join(' '),
    ].map(cell).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}
