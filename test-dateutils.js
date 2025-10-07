// Simple test for date utility functions
const { calculateAge, formatDateToISO, parseISODate, validateAge, getDateLimits } = require('./utils/dateUtils.ts');

// Test cases
const testDate1 = new Date('1990-05-15'); // Should be around 34 years old
const testDate2 = new Date('2010-12-25'); // Should be around 13-14 years old
const testDate3 = new Date('1900-01-01'); // Should be too old

console.log('Testing Date Utilities:');
console.log('======================');

// Test calculateAge
console.log('Age for 1990-05-15:', calculateAge(testDate1));
console.log('Age for 2010-12-25:', calculateAge(testDate2));

// Test formatDateToISO
console.log('ISO format for 1990-05-15:', formatDateToISO(testDate1));

// Test parseISODate
console.log('Parse "1990-05-15":', parseISODate('1990-05-15'));

// Test validateAge
console.log('Validate age 25:', validateAge(25));
console.log('Validate age 10:', validateAge(10));
console.log('Validate age 130:', validateAge(130));

// Test getDateLimits
const limits = getDateLimits();
console.log('Date limits:');
console.log('Min date:', limits.minDate.getFullYear());
console.log('Max date:', limits.maxDate.getFullYear());