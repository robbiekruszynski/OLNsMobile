export const colors = {
  background: '#0E1117',
  surface: '#161B22',
  surfaceAlt: '#1C2333',
  border: '#2A3245',
  accent: '#4FACDE',
  accentDim: '#2A5F80',
  textPrimary: '#E6EDF3',
  textSecondary: '#7D8590',
  textMeta: '#484F58',
  hopIndicator: '#3FB950',
  ghostNote: '#30363D',
  error: '#F85149',
  typeEmergency: '#E5433D',
  typeResource: '#3DAE6E',
  typeInformation: '#4FACDE',
  typeWaypoint: '#E5A030',
};

export function getNoteTypeColor(type: string): string {
  switch (type) {
    case 'emergency':
      return colors.typeEmergency;
    case 'resource':
      return colors.typeResource;
    case 'information':
      return colors.typeInformation;
    case 'waypoint':
      return colors.typeWaypoint;
    default:
      return colors.textSecondary;
  }
}
