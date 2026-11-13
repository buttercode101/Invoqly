import PublicQuoteClient from "./public-quote-client";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicQuoteClient token={token} />;
}
