import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fetchCitiesForCountry } from "@/lib/search";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ country: string }> },
) {
  await requireUser();
  const { country } = await params;
  const { cities, error } = await fetchCitiesForCountry(country);
  if (error && !cities.length) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json(cities);
}
