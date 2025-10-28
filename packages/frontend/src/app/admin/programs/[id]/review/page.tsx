import { ReviewInterface } from '@/components/programs/ReviewInterface';
import Link from 'next/link';

export default function ReviewPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center mb-6">
        <Link
          href={`/admin/programs/${params.id}`}
          className="text-blue-600 hover:text-blue-800 mr-4"
        >
          ← Back to Program
        </Link>
      </div>
      <ReviewInterface programId={params.id} />
    </div>
  );
}
