import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function GuestDashboard() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 pb-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Acceso Restringido</h2>
            <p className="text-muted-foreground text-lg">Favor de contactar al administrador</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
