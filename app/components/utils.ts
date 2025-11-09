// Utility function to convert Discord role color integer to hex
export function roleColorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
