import { notFound } from 'next/navigation';
import UserPageClient from './UserPageClient';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function UserPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return <UserPageClient userId={slug} />;
}
