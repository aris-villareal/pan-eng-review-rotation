import { WeekInfo, PeriodInfo, RotationConfig } from '../types';

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
    periodNumber: weekNumber,
    startDate,
    endDate,
    year: target.getFullYear(),
    type: 'week',
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

/**
 * Get rotation period info based on configuration
 */
export function getRotationPeriod(date: Date, config: RotationConfig): PeriodInfo {
  switch (config.frequency) {
    case 'daily':
      return getDayPeriod(date);
    case 'weekly':
      const weekInfo = getISOWeek(date);
      return {
        ...weekInfo,
        periodNumber: weekInfo.weekNumber,
        type: 'week',
      };
    case 'bi-weekly':
      return getBiWeeklyPeriod(date);
    case 'monthly':
      return getMonthPeriod(date);
    case 'custom':
      return getCustomPeriod(date, config.interval || 7);
    default:
      throw new Error(`Unsupported rotation frequency: ${config.frequency}`);
  }
}

/**
 * Calculate periods between two dates based on rotation config
 */
export function getPeriodsBetween(startDate: Date, endDate: Date, config: RotationConfig): number {
  switch (config.frequency) {
    case 'daily':
      return getDaysBetween(startDate, endDate);
    case 'weekly':
      return getWeeksBetween(startDate, endDate);
    case 'bi-weekly':
      return Math.floor(getWeeksBetween(startDate, endDate) / 2);
    case 'monthly':
      return getMonthsBetween(startDate, endDate);
    case 'custom':
      return Math.floor(getDaysBetween(startDate, endDate) / (config.interval || 7));
    default:
      throw new Error(`Unsupported rotation frequency: ${config.frequency}`);
  }
}

/**
 * Check if it's time for a new rotation based on config
 */
export function isNewRotationPeriod(lastRotationDate: string, currentDate: Date, config: RotationConfig): boolean {
  const lastDate = new Date(lastRotationDate);
  const periodsSince = getPeriodsBetween(lastDate, currentDate, config);
  return periodsSince > 0;
}

/**
 * Get day period info
 */
function getDayPeriod(date: Date): PeriodInfo {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);
  
  // Day number of year
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayNumber = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  return {
    periodNumber: dayNumber,
    startDate,
    endDate,
    year: date.getFullYear(),
    type: 'day',
  };
}

/**
 * Get bi-weekly period info
 */
function getBiWeeklyPeriod(date: Date): PeriodInfo {
  const weekInfo = getISOWeek(date);
  const biWeekNumber = Math.ceil(weekInfo.weekNumber / 2);
  
  return {
    periodNumber: biWeekNumber,
    startDate: weekInfo.startDate,
    endDate: new Date(weekInfo.endDate.getTime() + 7 * 24 * 60 * 60 * 1000),
    year: weekInfo.year,
    type: 'week',
  };
}

/**
 * Get month period info
 */
function getMonthPeriod(date: Date): PeriodInfo {
  const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return {
    periodNumber: date.getMonth() + 1,
    startDate,
    endDate,
    year: date.getFullYear(),
    type: 'month',
  };
}

/**
 * Get custom period info based on interval days
 */
function getCustomPeriod(date: Date, intervalDays: number): PeriodInfo {
  const epoch = new Date('2024-01-01'); // Reference date
  const daysSinceEpoch = Math.floor((date.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const periodNumber = Math.floor(daysSinceEpoch / intervalDays);
  
  const startDate = new Date(epoch.getTime() + periodNumber * intervalDays * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate.getTime() + (intervalDays - 1) * 24 * 60 * 60 * 1000);
  endDate.setHours(23, 59, 59, 999);
  
  return {
    periodNumber,
    startDate,
    endDate,
    year: date.getFullYear(),
    type: 'custom',
  };
}

/**
 * Calculate days between two dates
 */
function getDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate months between two dates
 */
function getMonthsBetween(startDate: Date, endDate: Date): number {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  return yearDiff * 12 + monthDiff;
} 