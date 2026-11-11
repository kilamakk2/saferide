export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
export const isValidName = (v: string) => v.trim().length >= 2;
