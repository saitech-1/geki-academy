import { describe, expect, it } from "vitest";
import { translate } from "./translations";

describe("learner interface languages", () => {
  it("keeps English instructions intact", () => {
    expect(translate("en", "Submit screenshot for review")).toBe(
      "Submit screenshot for review",
    );
  });
  it("covers Burmese QR payment and screenshot instructions", () => {
    for (const key of [
      "1. SCAN PAYMENT QR",
      "Payment screenshot",
      "Submit screenshot for review",
      "Receipt received.",
      "Your course unlocks after GEKI verifies the payment.",
    ])
      expect(translate("mm", key)).toMatch(/[\u1000-\u109f]/);
  });
  it("covers the main learner journey and device controls", () => {
    for (const key of [
      "MASTER THE ART.",
      "Account / guardian email",
      "Password",
      "Your journey to mastery continues.",
      "Course progress",
      "Remove registered device?",
      "Interface language",
      "Skip to content",
    ])
      expect(translate("mm", key)).toMatch(/[\u1000-\u109f]/);
  });
  it("preserves brand names and admin-written content without a translation", () => {
    expect(translate("mm", "GEKI Academy")).toBe("GEKI Academy");
    expect(translate("mm", "Instructor-authored lesson title")).toBe(
      "Instructor-authored lesson title",
    );
  });
});
