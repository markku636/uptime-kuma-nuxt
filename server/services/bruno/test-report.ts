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

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
}

/** Self-contained shareable report. Every value is escaped; no external assets or scripts. */
export function reportToHtml(report: ReturnType<typeof runReport>) {
  const rows = report.steps.map(step => {
    const rules = Array.isArray(step.assertions?.rules) ? step.assertions.rules : []
    const details = rules.length ? `<details><summary>${rules.filter((rule: any) => rule.passed).length}/${rules.length} assertions</summary><table><thead><tr><th>Rule</th><th>Source</th><th>Operator</th><th>Actual</th><th>Passed</th><th>Reason</th></tr></thead><tbody>${rules.map((rule: any) => `<tr><td>${escapeHtml(rule.ruleId)}</td><td>${escapeHtml(rule.source)}${rule.path ? ` ${escapeHtml(rule.path)}` : ''}</td><td>${escapeHtml(rule.operator)}</td><td>${escapeHtml(rule.actual ?? '—')}</td><td>${rule.passed ? 'yes' : 'no'}</td><td>${escapeHtml(rule.reason)}</td></tr>`).join('')}</tbody></table></details>` : '—'
    return `<tr><td>${step.stepIndex + 1}</td><td>${escapeHtml(step.name)} <small>${escapeHtml(step.method)}</small></td><td>${escapeHtml(step.status)}</td><td>${escapeHtml(step.httpStatus ?? '—')}</td><td>${escapeHtml(step.elapsedMs)} ms</td><td>${details}</td><td>${escapeHtml(step.errorCode || '—')}</td></tr>`
  }).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bruno test report #${escapeHtml(report.id)}</title><style>body{font:14px system-ui,sans-serif;margin:32px;color:#222}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}.pass{color:#0a7}.fail{color:#c33}small{color:#777}details{margin:0}</style></head><body><h1>Bruno test report #${escapeHtml(report.id)}</h1><p><strong class="${report.status === 'pass' ? 'pass' : 'fail'}">${escapeHtml(report.status)}</strong> · ${report.summary.passed} passed / ${report.summary.failed} failed / ${report.summary.skipped} skipped · ${report.summary.durationMs} ms</p><table><thead><tr><th>#</th><th>Name</th><th>Status</th><th>HTTP</th><th>Elapsed</th><th>Assertions</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}
