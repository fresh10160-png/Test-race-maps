import type { RouteStep } from './routing'

const MODIFIER_TEXT: Record<string, string> = {
  uturn: 'Make a U-turn',
  'sharp right': 'Sharp right turn',
  right: 'Turn right',
  'slight right': 'Bear right',
  straight: 'Continue straight',
  'slight left': 'Bear left',
  left: 'Turn left',
  'sharp left': 'Sharp left turn',
}

const MODIFIER_ICON: Record<string, string> = {
  uturn: '↩️',
  'sharp right': '↘️',
  right: '➡️',
  'slight right': '↗️',
  straight: '⬆️',
  'slight left': '↖️',
  left: '⬅️',
  'sharp left': '↙️',
}

export function maneuverIcon(step: RouteStep): string {
  if (step.maneuverType === 'depart') return '🚦'
  if (step.maneuverType === 'arrive') return '🏁'
  if (step.maneuverType === 'roundabout' || step.maneuverType === 'rotary') return '🔄'
  return MODIFIER_ICON[step.maneuverModifier ?? ''] ?? '⬆️'
}

export function describeManeuver(step: RouteStep): string {
  const streetPart = step.streetName ? ` onto ${step.streetName}` : ''
  if (step.maneuverType === 'depart') return `Head out${streetPart}`
  if (step.maneuverType === 'arrive') return 'Arrive at destination'
  if (step.maneuverType === 'roundabout' || step.maneuverType === 'rotary') {
    return `Enter the roundabout${streetPart}`
  }
  const modText = MODIFIER_TEXT[step.maneuverModifier ?? ''] ?? 'Continue'
  return `${modText}${streetPart}`
}
