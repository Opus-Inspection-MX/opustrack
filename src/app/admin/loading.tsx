import { TableSkeleton } from "@/components/common/skeletons";

/** Fallback for admin routes without their own loading state. */
export default function Loading() {
  return <TableSkeleton rows={8} />;
}
