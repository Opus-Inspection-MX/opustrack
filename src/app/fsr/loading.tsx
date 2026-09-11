import { PageSkeleton } from "@/components/common/skeletons";

/** Fallback for field routes without their own loading state. */
export default function Loading() {
  return <PageSkeleton />;
}
