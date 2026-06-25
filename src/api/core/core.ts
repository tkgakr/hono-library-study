export const isEmptyArray = <T>(value: T[]): boolean => value.length === 0

export const isEmptyOrWhitespaceString = (value: string): boolean => value.trim().length === 0
