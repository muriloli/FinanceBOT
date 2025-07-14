/**
 * Utilities for phone number formatting and validation
 */

export class PhoneUtils {
  /**
   * Formats a phone number to the standard format: 556677778888
   * Removes all non-digit characters and ensures proper Brazilian format
   */
  static formatToStandard(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Handle different input formats
    if (digits.length === 13 && digits.startsWith('55')) {
      // Already in format 556677778888
      return digits;
    } else if (digits.length === 11) {
      // Format: 11987654321 (without country code)
      return '55' + digits;
    } else if (digits.length === 10) {
      // Format: 1187654321 (without country code and 9)
      return '55' + digits.substring(0, 2) + '9' + digits.substring(2);
    } else if (digits.length === 12 && digits.startsWith('55')) {
      // Format: 551187654321 (missing the 9)
      const ddd = digits.substring(2, 4);
      const number = digits.substring(4);
      return '55' + ddd + '9' + number;
    }
    
    // Return as is if format is not recognized
    return digits;
  }

  /**
   * Extracts the core phone number (last 8 or 9 digits) for database search
   * This helps find users even with different formatting
   */
  static extractCoreNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    
    // Return last 8-9 digits for matching
    if (digits.length >= 9) {
      return digits.slice(-9); // Last 9 digits (9 + 8 digits)
    } else if (digits.length >= 8) {
      return digits.slice(-8); // Last 8 digits
    }
    
    return digits;
  }

  /**
   * Generates multiple search patterns for a phone number
   * to increase chances of finding the user in database
   */
  static generateSearchPatterns(phone: string): string[] {
    const formatted = this.formatToStandard(phone);
    const core = this.extractCoreNumber(phone);
    
    const patterns = [
      formatted,           // 556677778888
      phone,              // Original input
      core,               // 987654321
    ];

    // Add variations without country code
    if (formatted.startsWith('55')) {
      patterns.push(formatted.substring(2)); // 67778888
    }

    // Remove duplicates and empty strings
    return [...new Set(patterns)].filter(p => p.length > 0);
  }

  /**
   * Validates if a phone number looks like a valid Brazilian mobile
   */
  static isValidBrazilianMobile(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    
    // Check various valid formats
    if (digits.length === 13 && digits.startsWith('55')) {
      // 556677778888 - with country code
      const ddd = digits.substring(2, 4);
      const number = digits.substring(4);
      return parseInt(ddd) >= 11 && parseInt(ddd) <= 99 && number.length === 9;
    } else if (digits.length === 11) {
      // 11987654321 - without country code
      const ddd = digits.substring(0, 2);
      const number = digits.substring(2);
      return parseInt(ddd) >= 11 && parseInt(ddd) <= 99 && number.length === 9;
    }
    
    return false;
  }
}