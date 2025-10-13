import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, Users, BarChart3, AlertTriangle, Wrench, UserCog, Briefcase, FileText, User } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">OpusTrack</h1>
              <p className="text-xs text-muted-foreground">by OpusInspection</p>
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Shield className="h-4 w-4" />
            <span>Gestión Profesional de Incidentes</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Bienvenido a{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">OpusTrack</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Optimiza la gestión de incidentes, órdenes de trabajo y coordinación de equipos con la plataforma integral
            de seguimiento de OpusInspection.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Accede a tu Panel</h2>
            <p className="text-muted-foreground">Elige tu rol para acceder al panel correspondiente</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin" className="group">
              <Card className="border-2 hover:border-primary transition-all hover:shadow-lg h-full">
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto group-hover:bg-red-500/20 transition-colors">
                    <UserCog className="h-7 w-7 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Admin</h3>
                  <p className="text-sm text-muted-foreground">Acceso completo al sistema y gestión</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/fsr" className="group">
              <Card className="border-2 hover:border-primary transition-all hover:shadow-lg h-full">
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto group-hover:bg-blue-500/20 transition-colors">
                    <Briefcase className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg">FSR</h3>
                  <p className="text-sm text-muted-foreground">Servicio de campo y gestión de incidentes</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/client" className="group">
              <Card className="border-2 hover:border-primary transition-all hover:shadow-lg h-full">
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto group-hover:bg-orange-500/20 transition-colors">
                    <FileText className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Cliente</h3>
                  <p className="text-sm text-muted-foreground">Reporte y seguimiento de incidentes</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/guest" className="group">
              <Card className="border-2 hover:border-primary transition-all hover:shadow-lg h-full">
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto group-hover:bg-green-500/20 transition-colors">
                    <User className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Invitado</h3>
                  <p className="text-sm text-muted-foreground">Perfil personal e información</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Seguimiento de Incidentes</h3>
              <p className="text-sm text-muted-foreground">
                Reporta, rastrea y gestiona incidentes con actualizaciones de estado en tiempo real y documentación
                completa.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Wrench className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Gestión de Órdenes de Trabajo</h3>
              <p className="text-sm text-muted-foreground">
                Crea, asigna y completa órdenes de trabajo eficientemente con programación integrada y seguimiento de
                partes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Colaboración en Equipo</h3>
              <p className="text-sm text-muted-foreground">
                El control de acceso basado en roles asegura que los miembros del equipo tengan las herramientas e
                información correctas.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-3xl mx-auto border-2">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Construido para OpusInspection</h2>
            <p className="text-muted-foreground">
              OpusTrack es una plataforma privada de nivel empresarial diseñada específicamente para las necesidades
              operativas de OpusInspection. El acceso es gestionado por tu administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} OpusInspection. Todos los derechos reservados.</p>
          <p className="mt-2">OpusTrack - Sistema Profesional de Gestión de Incidentes</p>
        </div>
      </footer>
    </div>
  )
}
