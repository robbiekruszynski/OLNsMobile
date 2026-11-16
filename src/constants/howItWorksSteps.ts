import { colors } from '../theme/colors';

export const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    titleKey: 'home.steps.broadcast.title',
    descriptionKey: 'home.steps.broadcast.description',
    color: colors.typeEmergency,
  },
  {
    number: '02',
    titleKey: 'home.steps.propagate.title',
    descriptionKey: 'home.steps.propagate.description',
    color: colors.typeInformation,
  },
  {
    number: '03',
    titleKey: 'home.steps.persist.title',
    descriptionKey: 'home.steps.persist.description',
    color: colors.typeWaypoint,
  },
  {
    number: '04',
    titleKey: 'home.steps.discover.title',
    descriptionKey: 'home.steps.discover.description',
    color: colors.typeResource,
  },
  {
    number: '05',
    titleKey: 'home.steps.encrypt.title',
    descriptionKey: 'home.steps.encrypt.description',
    color: '#9B6DFF',
  },
] as const;
