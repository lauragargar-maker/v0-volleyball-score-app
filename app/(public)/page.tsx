import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Activity, Users, Clock, Share2, ChevronRight } from "lucide-react"

const features = [
  {
    icon: Activity,
    title: "Marcador en Tiempo Real",
    description: "Actualiza puntos al instante y todos los espectadores ven los cambios en vivo.",
  },
  {
    icon: Users,
    title: "Facil de Compartir",
    description: "Comparte el enlace del partido con familiares y amigos con un solo clic.",
  },
  {
    icon: Clock,
    title: "Historial Completo",
    description: "Guarda automaticamente el resultado de cada partido para consultarlo despues.",
  },
  {
    icon: Share2,
    title: "Acceso desde Cualquier Lugar",
    description: "Funciona en moviles, tablets y ordenadores sin necesidad de instalar nada.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">VS</span>
            </div>
            <span className="font-semibold text-foreground">VolleyScore</span>
          </div>
          <Link href="/auth/login">
            <Button size="sm">Iniciar Sesion</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container max-w-screen-xl px-4 py-16 md:py-24">
        <div className="flex flex-col items-center text-center gap-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Activity className="w-4 h-4" />
            <span>Marcador de Voleibol en Vivo</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground max-w-3xl text-balance">
            Controla los partidos de tu equipo en tiempo real
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty">
            La forma mas sencilla de llevar el marcador de los partidos de voleibol de tu equipo
            amateur y compartirlo con familiares y amigos.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
            <Link href="/auth/login">
              <Button size="lg" className="text-base px-8">
                Iniciar Sesion
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/solicitar-acceso">
              <Button variant="outline" size="lg" className="text-base px-8 bg-transparent">
                Solicitar Acceso
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container max-w-screen-xl px-4 py-16 border-t border-border/40">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Todo lo que necesitas para tus partidos
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Disenado para ser simple y efectivo, sin complicaciones innecesarias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* How it Works Section */}
      <section className="container max-w-screen-xl px-4 py-16 border-t border-border/40">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Como funciona
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-foreground mb-2">Inicia un Partido</h3>
            <p className="text-sm text-muted-foreground">
              Introduce los nombres de los equipos y comienza a registrar puntos.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-foreground mb-2">Comparte el Enlace</h3>
            <p className="text-sm text-muted-foreground">
              Envia el link a quien quiera seguir el partido en directo.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-foreground mb-2">Actualiza en Vivo</h3>
            <p className="text-sm text-muted-foreground">
              Toca para sumar puntos y todos veran el marcador actualizado al instante.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container max-w-screen-xl px-4 py-16 border-t border-border/40">
        <div className="bg-card border border-border/60 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Listo para empezar?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Si eres entrenador o colaborador del equipo, solicita acceso y empieza a usar
            VolleyScore en tu proximo partido.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/login">
              <Button size="lg" className="text-base px-8">
                Iniciar Sesion
              </Button>
            </Link>
            <Link href="/solicitar-acceso">
              <Button variant="outline" size="lg" className="text-base px-8 bg-transparent">
                Solicitar Acceso
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container max-w-screen-xl px-4 py-8 border-t border-border/40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/80 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">VS</span>
            </div>
            <span>VolleyScore</span>
          </div>
          <p>Hecho con cariño para equipos de voleibol amateur</p>
        </div>
      </footer>
    </div>
  )
}
