import { describe, expect, it } from "vitest";
import { resolveAssistantCustomerContact } from "./assistant-contact";

describe("AI customer contact safety", () => {
  it("uses a saved client's verified contact details", () => {
    expect(resolveAssistantCustomerContact({
      message: "Prepare an invoice for Acme. accounts@example.com",
      proposedCompany: "Acme Holdings",
      savedClient: { email: "billing@acme.example", company: "Acme Services" }
    })).toEqual({ email: "billing@acme.example", company: "Acme Services" });
  });

  it("uses one email explicitly supplied by the user, never a model-invented address", () => {
    expect(resolveAssistantCustomerContact({
      message: "Create an invoice for Acme, email accounts@example.com",
      proposedCompany: "Acme",
      savedClient: null
    })).toEqual({ email: "accounts@example.com", company: "Acme" });
  });

  it("leaves the email blank when the message contains no address or multiple addresses", () => {
    expect(resolveAssistantCustomerContact({ message: "Invoice Acme for support", savedClient: null })).toEqual({ email: "", company: "" });
    expect(resolveAssistantCustomerContact({
      message: "Invoice Acme, contact owner@example.com or accounts@example.com",
      savedClient: null
    })).toEqual({ email: "", company: "" });
  });

  it("does not accept a company name invented by the model", () => {
    expect(resolveAssistantCustomerContact({
      message: "Create an invoice for Acme",
      proposedCompany: "Acme Holdings (Pty) Ltd",
      savedClient: null
    })).toEqual({ email: "", company: "" });
  });
});
