"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

const workPartSchema = z.object({
  partId: z.string().min(1, "Part is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(999, "Quantity too high"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  price: z.number().min(0, "Price must be positive").max(999999, "Price too high"),
  workOrderId: z.string().optional(),
  workActivityId: z.string().optional(),
  active: z.boolean().default(true),
})

type WorkPartFormData = z.infer<typeof workPartSchema>

interface Part {
  id: string
  name: string
  price: number
  stock: number
  vic: {
    name: string
    code: string
  }
}

interface WorkOrder {
  id: string
  status: string
  incident: {
    title: string
  }
}

interface WorkActivity {
  id: string
  description: string
  workOrderId: string
}

interface WorkPartFormProps {
  workPart?: {
    id: string
    partId: string
    quantity: number
    description?: string
    price: number
    workOrderId?: string
    workActivityId?: string
    active: boolean
  }
  parts: Part[]
  workOrders: WorkOrder[]
  workActivities: WorkActivity[]
  onSubmit: (data: WorkPartFormData) => Promise<void>
}

export function WorkPartForm({ workPart, parts, workOrders, workActivities, onSubmit }: WorkPartFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>("")
  const [filteredActivities, setFilteredActivities] = useState<WorkActivity[]>([])
  const router = useRouter()

  const form = useForm<WorkPartFormData>({
    resolver: zodResolver(workPartSchema),
    defaultValues: {
      partId: workPart?.partId || "defaultPartId",
      quantity: workPart?.quantity || 1,
      description: workPart?.description || "",
      price: workPart?.price || 0,
      workOrderId: workPart?.workOrderId || "defaultWorkOrderId",
      workActivityId: workPart?.workActivityId || "defaultWorkActivityId",
      active: workPart?.active ?? true,
    },
  })

  const watchedPartId = form.watch("partId")
  const watchedWorkOrderId = form.watch("workOrderId")

  // Update price when part is selected
  useEffect(() => {
    if (watchedPartId) {
      const selectedPart = parts.find((p) => p.id === watchedPartId)
      if (selectedPart) {
        form.setValue("price", selectedPart.price)
      }
    }
  }, [watchedPartId, parts, form])

  // Filter activities by work order
  useEffect(() => {
    if (watchedWorkOrderId) {
      const filtered = workActivities.filter((activity) => activity.workOrderId === watchedWorkOrderId)
      setFilteredActivities(filtered)
      setSelectedWorkOrder(watchedWorkOrderId)
    } else {
      setFilteredActivities([])
      setSelectedWorkOrder("")
    }
  }, [watchedWorkOrderId, workActivities])

  const handleSubmit = async (data: WorkPartFormData) => {
    setIsLoading(true)
    try {
      await onSubmit(data)
      router.push("/admin/work-parts")
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPartStock = (partId: string) => {
    const part = parts.find((p) => p.id === partId)
    return part?.stock || 0
  }

  const calculateTotal = () => {
    const quantity = form.watch("quantity") || 0
    const price = form.watch("price") || 0
    return quantity * price
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{workPart ? "Edit Work Part" : "Add Work Part"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="partId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select part" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {parts.map((part) => (
                          <SelectItem key={part.id} value={part.id}>
                            <div className="flex flex-col">
                              <span>{part.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ${part.price} - Stock: {part.stock} - {part.vic.name}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {watchedPartId && (
                      <div className="text-sm text-muted-foreground">
                        Available stock: {getPartStock(watchedPartId)} units
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price ($) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Total Cost</FormLabel>
                <div className="p-3 bg-muted rounded-md">
                  <span className="text-lg font-semibold">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes about this part usage" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="workOrderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Order (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select work order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="defaultWorkOrderId">No work order</SelectItem>
                      {workOrders.map((workOrder) => (
                        <SelectItem key={workOrder.id} value={workOrder.id}>
                          <div className="flex flex-col">
                            <span>{workOrder.incident.title}</span>
                            <span className="text-sm text-muted-foreground">Status: {workOrder.status}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedWorkOrder && (
              <FormField
                control={form.control}
                name="workActivityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Activity (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select work activity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="defaultWorkActivityId">No specific activity</SelectItem>
                        {filteredActivities.map((activity) => (
                          <SelectItem key={activity.id} value={activity.id}>
                            {activity.description.length > 50
                              ? `${activity.description.substring(0, 50)}...`
                              : activity.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Work Part</FormLabel>
                    <div className="text-sm text-muted-foreground">Enable this work part record</div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner size="sm" />}
                {workPart ? "Update Work Part" : "Add Work Part"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/work-parts")}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
