"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { LineTable } from "@/components/lines/line-table"
import { getLines, deleteLine } from "@/lib/actions/lines"

export default function LinesPage() {
  const router = useRouter()
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    loadLines()
  }, [])

  const loadLines = async () => {
    try {
      const data = await getLines()
      setLines(data)
    } catch (error) {
      console.error("Error loading lines:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta línea?")) {
      return
    }

    try {
      await deleteLine(id)
      await loadLines()
    } catch (error) {
      console.error("Error deleting line:", error)
      alert("Error al eliminar la línea")
    }
  }

  const handleEdit = (id: number) => {
    router.push(`/admin/lines/${id}/edit`)
  }

  const handleView = (id: number) => {
    router.push(`/admin/lines/${id}`)
  }

  const paginatedLines = lines.slice(
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
          <h1 className="text-3xl font-bold">Líneas</h1>
          <p className="text-muted-foreground">Gestiona las líneas de inspección</p>
        </div>
        <Button onClick={() => router.push("/admin/lines/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Línea
        </Button>
      </div>

      <LineTable
        lines={paginatedLines}
        totalCount={lines.length}
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
