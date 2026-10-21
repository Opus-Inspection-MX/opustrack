import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { HelpContent } from "@/components/help/help-content";
import { requireAuth } from "@/lib/auth/auth";
import { getHelpGuide } from "@/lib/help/guides";

export default async function HelpGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuth();
  const guide = await getHelpGuide(slug, user);
  if (!guide) notFound();
  return (
    <PageContainer size="narrow">
      <Link
        href="/inicio/ayuda"
        className="text-sm text-primary underline underline-offset-4"
      >
        Todas las guías
      </Link>
      <PageHeader title={guide.title} description={guide.summary} />
      <article aria-label={guide.title} className="space-y-4 leading-relaxed">
        <HelpContent blocks={guide.blocks} />
      </article>
    </PageContainer>
  );
}
