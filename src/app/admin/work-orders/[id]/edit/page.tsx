"use client"

import { WorkOrderFormEnhanced } from "@/components/work-orders/work-order-form-enhanced"

const EditWorkOrderPage = ({ workOrder, onClose }) => {
  return (
    <div>
      <h1>Edit Work Order</h1>
      <WorkOrderFormEnhanced workOrder={workOrder} onClose={onClose} />
      {/* rest of code here */}
    </div>
  )
}

export default EditWorkOrderPage
