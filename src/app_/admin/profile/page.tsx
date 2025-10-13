"use client"

import { UserProfileForm } from "@/components/user-profiles/user-profile-form"

// Mock current user data
const mockCurrentUser = {
  id: "current_user_id",
  name: "John Doe",
  email: "john.doe@example.com",
  profile: {
    telephone: "+1-555-0123",
    secondaryTelephone: "+1-555-0124",
    emergencyContact: "Jane Doe - +1-555-0125",
    jobPosition: "Senior Technician",
  },
}

export default function ProfilePage() {
  const handleSubmit = async (data: any) => {
    console.log("Updating profile:", data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    alert("Profile updated successfully!")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal information</p>
      </div>

      <UserProfileForm initialData={mockCurrentUser} onSubmit={handleSubmit} isOwnProfile={true} />
    </div>
  )
}
