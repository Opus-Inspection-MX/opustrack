"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { EquipmentTable } from "@/components/equipments/equipment-table"
import { getEquipments, deleteEquipment } from "@/lib/actions/equipments"

export default function EquipmentsPage() {
  const router = useRouter()
  const [equipments, setEquipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    loadEquipments()
  }, [])

  const loadEquipments = async () => {
    try {
      const data = await getEquipments()
      setEquipments(data)
    } catch (error) {
      console.error("Error loading equipments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este equipo?")) {
      return
    }

    try {
      await deleteEquipment(id)
      await loadEquipments()
    } catch (error) {
      console.error("Error deleting equipment:", error)
      alert("Error al eliminar el equipo")
    }
  }

  const handleEdit = (id: number) => {
    router.push(`/admin/equipments/${id}/edit`)
  }

  const handleView = (id: number) => {
    router.push(`/admin/equipments/${id}`)
  }

  const paginatedEquipments = equipments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return <div>Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipos</h1>
          <p className="text-muted-foreground">Gestiona los equipos de las líneas</p>
        </div>
        <Button onClick={() => router.push("/admin/equipments/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Equipo
        </Button>
      </div>

      <EquipmentTable
        equipments={paginatedEquipments}
        totalCount={equipments.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  )
}
