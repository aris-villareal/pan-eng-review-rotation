import { getISOWeek, getWeeksBetween, isNewWeek, formatDateRange } from '../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('getISOWeek', () => {
    it('should calculate correct ISO week number', () => {
      // January 1, 2024 was actually week 52 of 2023 (ISO week rules)
      const date = new Date('2024-01-01');
      const weekInfo = getISOWeek(date);
      
      expect(weekInfo.weekNumber).toBe(52);
      expect(weekInfo.year).toBe(2023);
    });

    it('should handle year transitions correctly', () => {
      // December 31, 2023 was a Sunday (Week 52 of 2023)
      const date = new Date('2023-12-31');
      const weekInfo = getISOWeek(date);
      
      expect(weekInfo.weekNumber).toBe(52);
      expect(weekInfo.year).toBe(2023);
    });

    it('should calculate week start and end dates correctly', () => {
      const date = new Date('2024-01-03'); // Wednesday
      const weekInfo = getISOWeek(date);
      
      // Week should start on Monday and end on Sunday
      expect(weekInfo.startDate.getDay()).toBe(1); // Monday
      expect(weekInfo.endDate.getDay()).toBe(0); // Sunday
    });
  });

  describe('getWeeksBetween', () => {
    it('should calculate weeks between dates in same year', () => {
      const start = new Date('2024-01-02'); // Week 1 of 2024
      const end = new Date('2024-01-16'); // Week 3 of 2024
      const weeks = getWeeksBetween(start, end);
      
      expect(weeks).toBe(2);
    });

    it('should return 0 for same week', () => {
      const start = new Date('2024-01-02'); // Week 1 of 2024
      const end = new Date('2024-01-05'); // Same week
      const weeks = getWeeksBetween(start, end);
      
      expect(weeks).toBe(0);
    });

    it('should handle negative differences', () => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-01-01');
      const weeks = getWeeksBetween(start, end);
      
      expect(weeks).toBe(-2);
    });
  });

  describe('isNewWeek', () => {
    it('should return true for different weeks', () => {
      const lastRotation = '2024-01-08'; // Week 2
      const currentDate = new Date('2024-01-15'); // Week 3
      
      expect(isNewWeek(lastRotation, currentDate)).toBe(true);
    });

    it('should return false for same week', () => {
      const lastRotation = '2024-01-02'; // Tuesday of week 1
      const currentDate = new Date('2024-01-05'); // Friday, same week
      
      expect(isNewWeek(lastRotation, currentDate)).toBe(false);
    });
  });

  describe('formatDateRange', () => {
    it('should format date range correctly', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-07');
      
      const formatted = formatDateRange(start, end);
      
      expect(formatted).toContain('Dec 31, 2023');
      expect(formatted).toContain('Jan 6, 2024');
      expect(formatted).toContain('-');
    });

    it('should include year when crossing year boundary', () => {
      const start = new Date('2023-12-25');
      const end = new Date('2024-01-07');
      
      const formatted = formatDateRange(start, end);
      
      expect(formatted).toContain('2023');
      expect(formatted).toContain('2024');
    });
  });
}); 