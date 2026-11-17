export type PostalCodeParseResult = { postalCodes: string[]; invalid: string[]; duplicates: number; total: number };
export function parsePostalCodes(value: string): PostalCodeParseResult;
