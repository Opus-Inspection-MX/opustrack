"use client";

import { Suspense } from "react";
import NewWorkActivityForm from "./new-work-activity-form";

export default function NewWorkActivityWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewWorkActivityForm />
    </Suspense>
  );
}
