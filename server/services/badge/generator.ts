// server/services/badge/generator.ts

export interface BadgeOptions {
  label: string
  message: string
  labelColor?: string
  color?: string
  style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge'
  prefix?: string
  suffix?: string
}

/**
 * Generate an SVG badge
 */
export function generateBadge(options: BadgeOptions): string {
  const {
    label,
    message,
    labelColor = '#555',
    color = '#4c1',
    style = 'flat'
  } = options

  const labelWidth = getTextWidth(label) + 10
  const messageWidth = getTextWidth(message) + 10
  const totalWidth = labelWidth + messageWidth

  if (style === 'flat-square') {
    return generateFlatSquareBadge(label, message, labelColor, color, labelWidth, messageWidth, totalWidth)
  }

  if (style === 'for-the-badge') {
    return generateForTheBadge(label, message, labelColor, color)
  }

  if (style === 'plastic') {
    return generatePlasticBadge(label, message, labelColor, color, labelWidth, messageWidth, totalWidth)
  }

  // Default: flat
  return generateFlatBadge(label, message, labelColor, color, labelWidth, messageWidth, totalWidth)
}

function getTextWidth(text: string): number {
  // Approximate width calculation (simplified)
  return text.length * 6.5 + 10
}

function generateFlatBadge(
  label: string,
  message: string,
  labelColor: string,
  color: string,
  labelWidth: number,
  messageWidth: number,
  totalWidth: number
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="${labelColor}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${(labelWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${escapeXml(label)}</text>
    <text x="${(labelWidth / 2) * 10}" y="140" transform="scale(.1)">${escapeXml(label)}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${escapeXml(message)}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="140" transform="scale(.1)">${escapeXml(message)}</text>
  </g>
</svg>`
}

function generateFlatSquareBadge(
  label: string,
  message: string,
  labelColor: string,
  color: string,
  labelWidth: number,
  messageWidth: number,
  totalWidth: number
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
  <title>${label}: ${message}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="20" fill="${labelColor}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${(labelWidth / 2) * 10}" y="140" transform="scale(.1)">${escapeXml(label)}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="140" transform="scale(.1)">${escapeXml(message)}</text>
  </g>
</svg>`
}

function generatePlasticBadge(
  label: string,
  message: string,
  labelColor: string,
  color: string,
  labelWidth: number,
  messageWidth: number,
  totalWidth: number
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="18" role="img">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-opacity=".3"/>
    <stop offset="1" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="18" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="18" fill="${labelColor}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="18" fill="${color}"/>
    <rect width="${totalWidth}" height="18" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${(labelWidth / 2) * 10}" y="140" fill="#010101" fill-opacity=".3" transform="scale(.1)">${escapeXml(label)}</text>
    <text x="${(labelWidth / 2) * 10}" y="130" transform="scale(.1)">${escapeXml(label)}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="140" fill="#010101" fill-opacity=".3" transform="scale(.1)">${escapeXml(message)}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="130" transform="scale(.1)">${escapeXml(message)}</text>
  </g>
</svg>`
}

function generateForTheBadge(
  label: string,
  message: string,
  labelColor: string,
  color: string
): string {
  const labelWidth = getTextWidth(label.toUpperCase()) * 1.5
  const messageWidth = getTextWidth(message.toUpperCase()) * 1.5
  const totalWidth = labelWidth + messageWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img">
  <title>${label}: ${message}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="28" fill="${labelColor}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="28" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100">
    <text x="${(labelWidth / 2) * 10}" y="175" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">${escapeXml(label.toUpperCase())}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="175" font-weight="bold" transform="scale(.1)" textLength="${(messageWidth - 10) * 10}">${escapeXml(message.toUpperCase())}</text>
  </g>
</svg>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Get color for uptime percentage
 */
export function getUptimeColor(uptime: number): string {
  if (uptime >= 99) return '#4c1' // Green
  if (uptime >= 95) return '#a3c51c' // Yellow-green
  if (uptime >= 90) return '#dfb317' // Yellow
  if (uptime >= 80) return '#fe7d37' // Orange
  return '#e05d44' // Red
}

/**
 * Get color for status
 */
export function getStatusColor(status: 'up' | 'down' | 'pending' | 'maintenance'): string {
  switch (status) {
    case 'up': return '#4c1'
    case 'down': return '#e05d44'
    case 'pending': return '#dfb317'
    case 'maintenance': return '#9f9f9f'
    default: return '#9f9f9f'
  }
}

/**
 * Get color for ping
 */
export function getPingColor(ping: number): string {
  if (ping < 100) return '#4c1' // Green
  if (ping < 300) return '#a3c51c' // Yellow-green
  if (ping < 500) return '#dfb317' // Yellow
  if (ping < 1000) return '#fe7d37' // Orange
  return '#e05d44' // Red
}
