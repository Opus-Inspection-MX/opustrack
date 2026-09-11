import { CardGridSkeleton } from "@/components/common/skeletons";

/** Fallback for the /inicio home (Fase 3): a widget grid takes shape. */
export default function Loading() {
  return <CardGridSkeleton cards={8} />;
}
