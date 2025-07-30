import { WeekInfo, PeriodInfo, RotationConfig } from '../types';

/**
 * Get ISO week number for a given date
 */
export function getISOWeek(date: Date): WeekInfo {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7; // Make Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000); // 7 * 24 * 3600 * 1000

  // Calculate week start (Monday) and end (Sunday)
  const startDate = new Date(date);
  startDate.setUTCDate(date.getUTCDate() - dayNumber);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);

  return {
    weekNumber,
    periodNumber: weekNumber,
    startDate,
    endDate,
    year: target.getUTCFullYear(),
    type: 'week',
  };
}

/**
 * Get custom week info starting from a specific day
 */
export function getCustomWeek(date: Date, weekStartDay: number = 1): WeekInfo {
  // weekStartDay: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
  const target = new Date(date.valueOf());
  
  // Calculate days since the week start day
  const currentDay = date.getUTCDay(); // 0=Sunday, 1=Monday, etc.
  const daysSinceWeekStart = (currentDay - weekStartDay + 7) % 7;
  
  // Calculate week start and end
  const startDate = new Date(date);
  startDate.setUTCDate(date.getUTCDate() - daysSinceWeekStart);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);

  // Calculate week number based on the custom week start
  const epochStart = new Date(Date.UTC(2024, 0, 1)); // Reference date (Monday)
  const epochWeekStart = new Date(epochStart);
  const epochDayOfWeek = epochStart.getUTCDay();
  const daysToFirstWeekStart = (weekStartDay - epochDayOfWeek + 7) % 7;
  epochWeekStart.setUTCDate(epochStart.getUTCDate() + daysToFirstWeekStart);
  
  const weeksSinceEpoch = Math.floor((startDate.getTime() - epochWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekNumber = weeksSinceEpoch + 1;

  return {
    weekNumber,
    periodNumber: weekNumber,
    startDate,
    endDate,
    year: target.getUTCFullYear(),
    type: 'week',
  };
}

/**
 * Calculate the number of weeks between two dates
 */
export function getWeeksBetween(startDate: Date, endDate: Date, weekStartDay: number = 1): number {
  const start = weekStartDay === 1 ? getISOWeek(startDate) : getCustomWeek(startDate, weekStartDay);
  const end = weekStartDay === 1 ? getISOWeek(endDate) : getCustomWeek(endDate, weekStartDay);
  
  // Handle year transitions
  if (start.year === end.year) {
    return end.weekNumber - start.weekNumber;
  }
  
  // For custom weeks, calculate based on actual time difference
  if (weekStartDay !== 1) {
    const timeDiff = end.startDate.getTime() - start.startDate.getTime();
    return Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000));
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
    year: startDate.getUTCFullYear() !== endDate.getUTCFullYear() ? 'numeric' : undefined,
    timeZone: 'UTC'
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
export function isNewWeek(lastRotationDate: string, currentDate: Date, weekStartDay: number = 1): boolean {
  const lastDate = new Date(lastRotationDate);
  const lastWeek = weekStartDay === 1 ? getISOWeek(lastDate) : getCustomWeek(lastDate, weekStartDay);
  const currentWeek = weekStartDay === 1 ? getISOWeek(currentDate) : getCustomWeek(currentDate, weekStartDay);
  
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
      const weekStartDay = config.schedule?.dayOfWeek || 1; // Default to Monday if not specified
      const weekInfo = weekStartDay === 1 ? getISOWeek(date) : getCustomWeek(date, weekStartDay);
      return {
        ...weekInfo,
        periodNumber: weekInfo.weekNumber,
        type: 'week',
      };
    case 'bi-weekly':
      return getBiWeeklyPeriod(date, config);
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
      const weekStartDay = config.schedule?.dayOfWeek || 1; // Default to Monday if not specified
      return getWeeksBetween(startDate, endDate, weekStartDay);
    case 'bi-weekly':
      const biWeekStartDay = config.schedule?.dayOfWeek || 1;
      return Math.floor(getWeeksBetween(startDate, endDate, biWeekStartDay) / 2);
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
  startDate.setUTCHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setUTCHours(23, 59, 59, 999);
  
  // Day number of year
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  const dayNumber = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  return {
    periodNumber: dayNumber,
    startDate,
    endDate,
    year: date.getUTCFullYear(),
    type: 'day',
  };
}

/**
 * Get bi-weekly period info
 */
function getBiWeeklyPeriod(date: Date, config: RotationConfig): PeriodInfo {
  const weekStartDay = config.schedule?.dayOfWeek || 1;
  const weekInfo = weekStartDay === 1 ? getISOWeek(date) : getCustomWeek(date, weekStartDay);
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
  const startDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  
  return {
    periodNumber: date.getUTCMonth() + 1,
    startDate,
    endDate,
    year: date.getUTCFullYear(),
    type: 'month',
  };
}

/**
 * Get custom period info based on interval days
 */
function getCustomPeriod(date: Date, intervalDays: number): PeriodInfo {
  const epoch = new Date(Date.UTC(2024, 0, 1)); // Reference date
  const daysSinceEpoch = Math.floor((date.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const periodNumber = Math.floor(daysSinceEpoch / intervalDays);
  
  const startDate = new Date(epoch.getTime() + periodNumber * intervalDays * 24 * 60 * 60 * 1000);
  startDate.setUTCHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate.getTime() + (intervalDays - 1) * 24 * 60 * 60 * 1000);
  endDate.setUTCHours(23, 59, 59, 999);
  
  return {
    periodNumber,
    startDate,
    endDate,
    year: date.getUTCFullYear(),
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
  const yearDiff = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  const monthDiff = endDate.getUTCMonth() - startDate.getUTCMonth();
  return yearDiff * 12 + monthDiff;
} 