import { asc } from "drizzle-orm";
import { db } from "@/db";
import { positions } from "@/db/schema";

export type Position = typeof positions.$inferSelect;

export async function getPositions(): Promise<Position[]> {
  return db.query.positions.findMany({
    orderBy: [asc(positions.displayOrder)],
  });
}
