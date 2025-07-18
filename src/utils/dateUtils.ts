import { WeekInfo } from '../types';

/**
 * Get ISO week number for a given date
 */
export function getISOWeek(date: Date): WeekInfo {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7; // Make Monday = 0
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000); // 7 * 24 * 3600 * 1000

  // Calculate week start (Monday) and end (Sunday)
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - dayNumber);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return {
    weekNumber,
    startDate,
    endDate,
    year: target.getFullYear(),
  };
}

/**
 * Calculate the number of weeks between two dates
 */
export function getWeeksBetween(startDate: Date, endDate: Date): number {
  const start = getISOWeek(startDate);
  const end = getISOWeek(endDate);
  
  // Handle year transitions
  if (start.year === end.year) {
    return end.weekNumber - start.weekNumber;
  }
  
  // Get weeks remaining in start year + weeks in end year
  const weeksInStartYear = getISOWeeksInYear(start.year);
  const weeksFromStart = weeksInStartYear - start.weekNumber;
  const totalWeeks = weeksFromStart + end.weekNumber + ((end.year - start.year - 1) * 52);
  
  return totalWeeks;
}

/**
 * Get number of ISO weeks in a given year
 */
export function getISOWeeksInYear(year: number): number {
  const dec28 = new Date(year, 11, 28);
  return getISOWeek(dec28).weekNumber;
}

/**
 * Format date for display
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric',
    year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
  };
  
  const start = startDate.toLocaleDateString('en-US', options);
  const end = endDate.toLocaleDateString('en-US', options);
  
  return `${start} - ${end}`;
}

/**
 * Get current date in specified timezone
 */
export function getCurrentDateInTimezone(timezone: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * Check if it's a new week since the last rotation
 */
export function isNewWeek(lastRotationDate: string, currentDate: Date): boolean {
  const lastDate = new Date(lastRotationDate);
  const lastWeek = getISOWeek(lastDate);
  const currentWeek = getISOWeek(currentDate);
  
  return lastWeek.weekNumber !== currentWeek.weekNumber || lastWeek.year !== currentWeek.year;
} 