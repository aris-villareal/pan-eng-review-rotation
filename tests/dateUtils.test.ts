import { getISOWeek, getCustomWeek, getWeeksBetween, isNewWeek, formatDateRange, getRotationPeriod } from '../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('getISOWeek', () => {
    it('should calculate correct ISO week number', () => {
      // Using UTC constructor: January 1, 2024 was a Monday (week 1 of 2024)
      const date = new Date(Date.UTC(2024, 0, 1)); // January 1, 2024 UTC
      const weekInfo = getISOWeek(date);
      
      expect(weekInfo.weekNumber).toBe(1);
      expect(weekInfo.year).toBe(2024);
    });

    it('should handle year transitions correctly', () => {
      // December 31, 2023 was a Sunday (Week 52 of 2023)
      const date = new Date(Date.UTC(2023, 11, 31)); // December 31, 2023 UTC
      const weekInfo = getISOWeek(date);
      
      expect(weekInfo.weekNumber).toBe(52);
      expect(weekInfo.year).toBe(2023);
    });

    it('should calculate week start and end dates correctly', () => {
      const date = new Date(Date.UTC(2024, 0, 3)); // Wednesday, January 3, 2024 UTC
      const weekInfo = getISOWeek(date);
      
      // Week should start on Monday and end on Sunday
      expect(weekInfo.startDate.getUTCDay()).toBe(1); // Monday
      expect(weekInfo.endDate.getUTCDay()).toBe(0); // Sunday
    });
  });

  describe('getWeeksBetween', () => {
    it('should calculate weeks between dates in same year', () => {
      const start = new Date(Date.UTC(2024, 0, 2)); // Week 1 of 2024
      const end = new Date(Date.UTC(2024, 0, 16)); // Week 3 of 2024
      const weeks = getWeeksBetween(start, end);
      
      expect(weeks).toBe(2);
    });

    it('should return 0 for same week', () => {
      const start = new Date(Date.UTC(2024, 0, 2)); // Week 1 of 2024
      const end = new Date(Date.UTC(2024, 0, 5)); // Same week
      const weeks = getWeeksBetween(start, end);
      
      expect(weeks).toBe(0);
    });

    it('should handle negative differences', () => {
      const start = new Date(Date.UTC(2024, 0, 15));
      const end = new Date(Date.UTC(2024, 0, 1));
      const weeks = getWeeksBetween(start, end);
      
      expect(weeks).toBe(-2);
    });
  });

  describe('isNewWeek', () => {
    it('should return true for different weeks', () => {
      const lastRotation = '2024-01-08T00:00:00.000Z'; // Week 2
      const currentDate = new Date(Date.UTC(2024, 0, 15)); // Week 3
      
      expect(isNewWeek(lastRotation, currentDate)).toBe(true);
    });

    it('should return false for same week', () => {
      const lastRotation = '2024-01-02T00:00:00.000Z'; // Tuesday of week 1
      const currentDate = new Date(Date.UTC(2024, 0, 5)); // Friday, same week
      
      expect(isNewWeek(lastRotation, currentDate)).toBe(false);
    });
  });

  describe('getCustomWeek', () => {
    it('should calculate Friday-to-Thursday weeks correctly', () => {
      // Test with Monday, January 20, 2025 (should be in week starting Friday, Jan 17)
      const testDate = new Date(Date.UTC(2025, 0, 20)); // Monday, Jan 20, 2025
      const weekInfo = getCustomWeek(testDate, 5); // Friday = 5
      
      // Week should start on Friday (Jan 17) and end on Thursday (Jan 23)
      expect(weekInfo.startDate.getUTCDay()).toBe(5); // Friday
      expect(weekInfo.endDate.getUTCDay()).toBe(4); // Thursday
      expect(weekInfo.startDate.getUTCDate()).toBe(17); // Jan 17
      expect(weekInfo.endDate.getUTCDate()).toBe(23); // Jan 23
    });

    it('should handle Friday as start of week', () => {
      // Test with Friday itself
      const fridayDate = new Date(Date.UTC(2025, 0, 17)); // Friday, Jan 17, 2025
      const weekInfo = getCustomWeek(fridayDate, 5);
      
      // Should be start of the week
      expect(weekInfo.startDate.getUTCDate()).toBe(17); // Same day
      expect(weekInfo.endDate.getUTCDate()).toBe(23); // Following Thursday
    });

    it('should handle Thursday as end of week', () => {
      // Test with Thursday
      const thursdayDate = new Date(Date.UTC(2025, 0, 23)); // Thursday, Jan 23, 2025
      const weekInfo = getCustomWeek(thursdayDate, 5);
      
      // Should be end of the week
      expect(weekInfo.startDate.getUTCDate()).toBe(17); // Previous Friday
      expect(weekInfo.endDate.getUTCDate()).toBe(23); // Same day
    });
  });

  describe('getRotationPeriod with Friday-to-Thursday config', () => {
    it('should use Friday-to-Thursday weeks for weekly rotation', () => {
      const config = { frequency: 'weekly' as const, schedule: { dayOfWeek: 5, time: '09:00' } };
      const testDate = new Date(Date.UTC(2025, 0, 20)); // Monday, Jan 20, 2025
      
      const period = getRotationPeriod(testDate, config);
      
      expect(period.startDate.getUTCDay()).toBe(5); // Friday
      expect(period.endDate.getUTCDay()).toBe(4); // Thursday
      expect(period.startDate.getUTCDate()).toBe(17); // Jan 17
      expect(period.endDate.getUTCDate()).toBe(23); // Jan 23
    });

    it('should default to Monday-to-Sunday for weekly rotation without dayOfWeek', () => {
      const config = { frequency: 'weekly' as const, schedule: { time: '09:00' } };
      const testDate = new Date(Date.UTC(2025, 0, 20)); // Monday, Jan 20, 2025
      
      const period = getRotationPeriod(testDate, config);
      
      expect(period.startDate.getUTCDay()).toBe(1); // Monday
      expect(period.endDate.getUTCDay()).toBe(0); // Sunday
    });
  });

  describe('isNewWeek with custom week start', () => {
    it('should detect new Friday-to-Thursday week correctly', () => {
      const lastRotation = '2025-01-16T00:00:00.000Z'; // Thursday (end of one week)
      const currentDate = new Date(Date.UTC(2025, 0, 17)); // Friday (start of next week)
      
      expect(isNewWeek(lastRotation, currentDate, 5)).toBe(true);
    });

    it('should return false for same Friday-to-Thursday week', () => {
      const lastRotation = '2025-01-17T00:00:00.000Z'; // Friday (start of week)
      const currentDate = new Date(Date.UTC(2025, 0, 20)); // Monday (same week)
      
      expect(isNewWeek(lastRotation, currentDate, 5)).toBe(false);
    });
  });

  describe('formatDateRange', () => {
    it('should format date range correctly', () => {
      const start = new Date(Date.UTC(2024, 0, 1)); // January 1, 2024 UTC (Monday)
      const end = new Date(Date.UTC(2024, 0, 7)); // January 7, 2024 UTC (Sunday)
      
      const formatted = formatDateRange(start, end);
      
      expect(formatted).toContain('Jan 1');
      expect(formatted).toContain('Jan 7');
      expect(formatted).toContain('-');
    });

    it('should include year when crossing year boundary', () => {
      const start = new Date(Date.UTC(2023, 11, 25)); // December 25, 2023 UTC
      const end = new Date(Date.UTC(2024, 0, 7)); // January 7, 2024 UTC
      
      const formatted = formatDateRange(start, end);
      
      expect(formatted).toContain('2023');
      expect(formatted).toContain('2024');
    });
  });
}); 