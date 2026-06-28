/**
 * Port for QR code generation operations.
 * Wraps library-specific QR code implementations (e.g., qrcode).
 */
export interface QrCodePort {
  /**
   * Generate a QR code as a data URL
   * @param text The text to encode in the QR code
   * @returns Data URL string (e.g., "data:image/png;base64,...")
   */
  toDataURL(text: string): Promise<string>;
}
