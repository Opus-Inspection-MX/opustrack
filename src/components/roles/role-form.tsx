"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft } from "lucide-react"

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(50, "Role name must be less than 50 characters"),
  defaultPath: z.string().min(1, "Default path is required").regex(/^\//, "Path must start with /"),
  active: z.boolean().default(true),
})

type RoleFormData = z.infer<typeof roleSchema>

interface RoleFormProps {
  role?: {
    id: number
    name: string
    defaultPath: string
    active: boolean
  }
  onSubmit: (data: RoleFormData) => Promise<void>
}

export function RoleForm({ role, onSubmit }: RoleFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name || "",
      defaultPath: role?.defaultPath || "/admin",
      active: role?.active ?? true,
    },
  })

  const handleSubmit = async (data: RoleFormData) => {
    setIsLoading(true)
    try {
      await onSubmit(data)
      router.push("/admin/roles")
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{role ? "Edit Role" : "Create Role"}</h1>
          <p className="text-muted-foreground">{role ? "Update role information" : "Add a new role to the system"}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{role ? "Edit Role" : "Create Role"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter role name (e.g., Admin, Technician)" {...field} />
                    </FormControl>
                    <FormDescription>A unique name for this role that describes the user type</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Path</FormLabel>
                    <FormControl>
                      <Input placeholder="/admin" {...field} />
                    </FormControl>
                    <FormDescription>
                      The default page users with this role will be redirected to after login
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>When disabled, users cannot be assigned to this role</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Spinner size="sm" className="mr-2" />}
                  {role ? "Update Role" : "Create Role"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/admin/roles")}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
