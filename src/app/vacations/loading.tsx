import { PageSkeleton } from "@/components/common/skeletons";

/** Fallback for vacation routes without their own loading state. */
export default function Loading() {
  return <PageSkeleton />;
}
