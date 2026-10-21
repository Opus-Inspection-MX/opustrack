import Link from "next/link";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/auth";
import { getHelpGroups } from "@/lib/help/guides";

export const metadata = { title: "Ayuda | OpusTrack" };

export default async function HelpPage() {
  const user = await requireAuth();
  const groups = await getHelpGroups(user);
  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Ayuda"
        description="Guías de las tareas disponibles para sus roles y permisos."
      />
      <p className="text-sm text-muted-foreground">
        Los permisos de su cuenta determinan las opciones disponibles. Consultar
        una guía no habilita nuevas funciones; si una opción no aparece,
        solicite apoyo a su administrador.
      </p>
      <p className="text-sm text-muted-foreground">
        Roles de su cuenta: {user.roles.map((role) => role.name).join(", ")}.
        Las guías compartidas pueden aparecer en más de un rol.
      </p>
      {groups.length === 0 && (
        <p>Todavía no hay guías disponibles para sus permisos.</p>
      )}
      <nav aria-label="Guías de usuario" className="space-y-8">
        {groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`help-${group.id}`}
            className="space-y-4"
          >
            <h2
              id={`help-${group.id}`}
              className="font-display text-xl font-semibold"
            >
              {group.title}
            </h2>
            {group.id === "combined" && (
              <p className="text-sm text-muted-foreground">
                Estas tareas están disponibles por la combinación de los
                permisos de sus roles.
              </p>
            )}
            <ul className="space-y-4">
              {group.guides.map((guide) => (
                <li key={guide.slug}>
                  <Card>
                    <CardContent className="space-y-2">
                      <h3 className="text-lg font-semibold">
                        <Link
                          href={`/inicio/ayuda/${guide.slug}`}
                          className="text-primary underline underline-offset-4 hover:no-underline"
                        >
                          {guide.title}
                        </Link>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {guide.summary}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </PageContainer>
  );
}
