import { describe, expect, it } from "vitest";
import {
  blendRating,
  statToRating,
  BLEND_SAMPLE_SIZE_THRESHOLD,
} from "../stat-scaling";

describe("statToRating", () => {
  // 20 evenly-spaced values (double the 10 rating buckets) so interior
  // points don't land exactly on a bucket boundary — a dataset the same
  // size as the bucket count would make every value a boundary case.
  const twentyValues = Array.from({ length: 20 }, (_, i) => i + 1);

  it("gives the lowest value in a spread-out set the lowest rating", () => {
    expect(statToRating(1, twentyValues)).toBe(1);
  });

  it("gives the highest value in a spread-out set the highest rating", () => {
    expect(statToRating(20, twentyValues)).toBe(10);
  });

  it("gives a mid-pack value a middling rating", () => {
    expect(statToRating(9, twentyValues)).toBe(5);
  });

  it("falls back to neutral when every value is tied (no spread)", () => {
    expect(statToRating(3, [3, 3, 3])).toBe(5);
    expect(statToRating(7, [3, 3, 3])).toBe(5);
  });

  it("falls back to neutral with an empty comparison set", () => {
    expect(statToRating(1, [])).toBe(5);
  });
});

describe("blendRating", () => {
  it("returns the qualitative rating outright when there's no stat signal", () => {
    expect(blendRating(2, null, 100)).toBe(2);
  });

  it("defaults to neutral when neither input has a value", () => {
    expect(blendRating(null, null, 0)).toBe(5);
  });

  it("returns the qualitative rating outright at zero sample size", () => {
    expect(blendRating(2, 5, 0)).toBe(2);
  });

  it("returns the stat rating outright at or past the sample-size threshold", () => {
    expect(blendRating(2, 5, BLEND_SAMPLE_SIZE_THRESHOLD)).toBe(5);
    expect(blendRating(2, 5, BLEND_SAMPLE_SIZE_THRESHOLD * 2)).toBe(5);
  });

  it("linearly blends at a partial sample size", () => {
    expect(blendRating(2, 5, BLEND_SAMPLE_SIZE_THRESHOLD / 2)).toBe(3.5);
  });

  it("treats a missing qualitative rating as neutral before blending", () => {
    expect(blendRating(null, 5, BLEND_SAMPLE_SIZE_THRESHOLD)).toBe(5);
    expect(blendRating(null, 5, 0)).toBe(5);
  });
});
