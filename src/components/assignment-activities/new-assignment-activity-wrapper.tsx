"use client";

import { Suspense } from "react";
import NewAssignmentActivityForm from "./new-assignment-activity-form";

export default function NewAssignmentActivityWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewAssignmentActivityForm />
    </Suspense>
  );
}
