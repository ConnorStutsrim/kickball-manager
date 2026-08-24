import { db } from "@/db";
import { positionShoreUpWeights } from "@/db/schema";

export type PositionShoreUpWeightRow = typeof positionShoreUpWeights.$inferSelect;

export async function getPositionShoreUpWeights(): Promise<PositionShoreUpWeightRow[]> {
  return db.query.positionShoreUpWeights.findMany();
}
