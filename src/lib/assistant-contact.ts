export type SavedCustomerContact = { email?: string | null; company?: string | null };

export function resolveAssistantCustomerContact(input: {
  message: string;
  proposedCompany?: string | null;
  savedClient?: SavedCustomerContact | null;
}): { email: string; company: string } {
  const explicitEmails = [...input.message.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi)].map(match => match[0]!);
  const savedEmail = input.savedClient?.email?.trim() ?? "";
  const savedCompany = input.savedClient?.company?.trim() ?? "";
  const proposedCompany = input.proposedCompany?.trim() ?? "";
  return {
    email: savedEmail || (explicitEmails.length === 1 ? explicitEmails[0]! : ""),
    company: savedCompany || (proposedCompany && input.message.toLowerCase().includes(proposedCompany.toLowerCase()) ? proposedCompany : "")
  };
}
