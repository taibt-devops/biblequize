import type { TFunction } from 'i18next'

/**
 * Picks a localized time-of-day greeting using the existing
 * home.greeting{Morning,Afternoon,Evening} keys. Buckets: morning
 * (<12h), afternoon (<18h), evening (rest).
 */
export function getTimeOfDayGreeting(t: TFunction): string {
  const hour = new Date().getHours()
  if (hour < 12) return t('home.greetingMorning') as string
  if (hour < 18) return t('home.greetingAfternoon') as string
  return t('home.greetingEvening') as string
}
