"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UserStatusTable } from "@/components/user-status/user-status-table";
import { deleteUserStatus, getUserStatuses } from "@/lib/actions/lookups";

export default function UserStatusPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userStatuses, setUserStatuses] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getUserStatuses();
      setUserStatuses(data);
    } catch (error) {
      console.error("Error fetching user statuses:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (id: number) => {
    router.push(`/admin/user-status/${id}/edit`);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this user status?")) {
      try {
        await deleteUserStatus(id);
        await fetchData();
      } catch (error) {
        console.error("Error deleting user status:", error);
        alert("Failed to delete user status");
      }
    }
  };

  const handleView = (id: number) => {
    router.push(`/admin/user-status/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading user statuses..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Status</h1>
          <p className="text-muted-foreground">
            Manage user status types and their configurations
          </p>
        </div>
        <Button onClick={() => router.push("/admin/user-status/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New User Status
        </Button>
      </div>

      <UserStatusTable
        data={userStatuses}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
