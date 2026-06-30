import countries from "./countries.json";
import type { Country } from "@/types";

export const COUNTRIES = countries as Country[];

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}
