import { describe,it,expect } from 'vitest';
import { dateAdd, instantDateKey, sundayStartInstant } from './date';
describe('America/Chicago calendar',()=>{
  it('uses Chicago day boundaries regardless of the device timezone',()=>{
    expect(instantDateKey('2026-09-14T03:00:00Z')).toBe('2026-09-13');
    expect(instantDateKey('2026-09-14T05:00:00Z')).toBe('2026-09-14');
    expect(instantDateKey('2026-01-01 03:00:00')).toBe('2025-12-31');
  });
  it('keeps calendar days across DST and uses Sunday for Weekly Review',()=>{
    expect(dateAdd('2026-03-08',1)).toBe('2026-03-09');
    expect(dateAdd('2026-11-01',1)).toBe('2026-11-02');
    expect(sundayStartInstant('2026-03-09')).toBe('2026-03-08T06:00:00Z');
    expect(sundayStartInstant('2026-11-02')).toBe('2026-11-01T05:00:00Z');
  });
});
