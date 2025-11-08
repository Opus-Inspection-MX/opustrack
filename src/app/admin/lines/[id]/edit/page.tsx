import { LineForm } from "@/components/lines/line-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getLineById } from "@/lib/actions/lines"
import { notFound } from "next/navigation"

interface EditLinePageProps {
  params: Promise<{ id: string }>
}

export default async function EditLinePage({ params }: EditLinePageProps) {
  const { id } = await params

  try {
    const line = await getLineById(parseInt(id))

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/lines">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Línea</h1>
            <p className="text-muted-foreground">Actualiza la información de la línea</p>
          </div>
        </div>

        <LineForm mode="edit" line={line} />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
