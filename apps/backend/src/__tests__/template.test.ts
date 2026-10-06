import { describe, expect, it } from "vitest";
import { extractVariableCount, isValidTemplateName, renderTemplateBody } from "../utils/template";

describe("template validation", () => {
  it("accepts a valid snake_case template name", () => {
    expect(isValidTemplateName("appointment_confirmation")).toBe(true);
  });

  it("rejects names with spaces or capital letters", () => {
    expect(isValidTemplateName("Appointment Confirmation")).toBe(false);
  });

  it("rejects names shorter than 3 characters", () => {
    expect(isValidTemplateName("ab")).toBe(false);
  });

  it("counts distinct numbered variables in the body", () => {
    expect(extractVariableCount("Hi {{1}}, your order {{2}} is ready. Thanks {{1}}!")).toBe(2);
  });

  it("returns zero for a body without variables", () => {
    expect(extractVariableCount("Thanks for visiting our showroom.")).toBe(0);
  });

  it("renders variables into the body text", () => {
    const rendered = renderTemplateBody("Hi {{1}}, your {{2}} is ready.", { "1": "Aarav", "2": "quotation" });
    expect(rendered).toBe("Hi Aarav, your quotation is ready.");
  });

  it("leaves unresolved placeholders intact", () => {
    const rendered = renderTemplateBody("Hi {{1}}, code {{2}}.", { "1": "Aarav" });
    expect(rendered).toBe("Hi Aarav, code {{2}}.");
  });
});
