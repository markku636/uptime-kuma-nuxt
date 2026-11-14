export default defineEventHandler(async event => {
  const { monitor } = await requireMonitor(event)
  if (!monitor.tlsInfo) return { hasCertificate: false, message: 'Certificate information is available after a successful HTTPS check' }
  return { hasCertificate: true, certificate: monitor.tlsInfo }
})
