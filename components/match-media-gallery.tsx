"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { MatchMedia } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImagePlus, Trash2, Loader2, Play, X, Camera, Film } from "lucide-react"

interface MatchMediaGalleryProps {
  matchId: string
  isOpen: boolean
  onClose: () => void
  matchTitle: string
}

export function MatchMediaGallery({ matchId, isOpen, onClose, matchTitle }: MatchMediaGalleryProps) {
  const { isAdmin, user } = useAuth()
  const [media, setMedia] = useState<MatchMedia[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<MatchMedia | null>(null)
  const [caption, setCaption] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadMedia()
    }
  }, [isOpen, matchId])

  const loadMedia = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("match_media")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setMedia(data)
    }
    setIsLoading(false)
  }

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from("match-media").getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !user) return

    setIsUploading(true)

    for (const file of Array.from(files)) {
      const fileType = file.type.startsWith("video/") ? "video" : "image"
      const fileExt = file.name.split(".").pop()
      const fileName = `${matchId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage.from("match-media").upload(fileName, file)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        continue
      }

      // Save reference in database
      const { error: dbError } = await supabase.from("match_media").insert({
        match_id: matchId,
        file_path: fileName,
        file_type: fileType,
        caption: caption || null,
        uploaded_by: user.id,
      })

      if (dbError) {
        console.error("Database error:", dbError)
      }
    }

    setCaption("")
    await loadMedia()
    setIsUploading(false)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (mediaItem: MatchMedia) => {
    if (!confirm("¿Seguro que quieres eliminar este archivo?")) return

    // Delete from storage
    await supabase.storage.from("match-media").remove([mediaItem.file_path])

    // Delete from database
    await supabase.from("match_media").delete().eq("id", mediaItem.id)

    await loadMedia()
    setSelectedMedia(null)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Fotos y Videos - {matchTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Upload section - only for admins */}
            {isAdmin && (
              <div className="mb-4 rounded-lg border border-dashed border-muted-foreground/30 p-4">
                <div className="flex flex-col gap-3">
                  <Input
                    placeholder="Descripción (opcional)"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="bg-transparent"
                  />
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="media-upload"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex-1 gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          Añadir fotos o videos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Gallery grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : media.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {isAdmin
                    ? "No hay fotos ni videos. ¡Añade el primer recuerdo!"
                    : "No hay fotos ni videos de este partido."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => setSelectedMedia(item)}
                  >
                    {item.file_type === "image" ? (
                      <img
                        src={getPublicUrl(item.file_path) || "/placeholder.svg"}
                        alt={item.caption || "Foto del partido"}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="relative h-full w-full">
                        <video src={getPublicUrl(item.file_path)} className="h-full w-full object-cover" muted />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-10 w-10 text-white" fill="white" />
                        </div>
                      </div>
                    )}
                    {item.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="truncate text-xs text-white">{item.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full view dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-h-[95vh] max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setSelectedMedia(null)}
            >
              <X className="h-4 w-4" />
            </Button>

            {isAdmin && selectedMedia && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-2 z-10 bg-red-500/80 hover:bg-red-600 text-white"
                onClick={() => handleDelete(selectedMedia)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {selectedMedia?.file_type === "image" ? (
              <img
                src={getPublicUrl(selectedMedia.file_path) || "/placeholder.svg"}
                alt={selectedMedia.caption || "Foto del partido"}
                className="max-h-[90vh] w-full object-contain"
              />
            ) : selectedMedia?.file_type === "video" ? (
              <video src={getPublicUrl(selectedMedia.file_path)} controls autoPlay className="max-h-[90vh] w-full" />
            ) : null}

            {selectedMedia?.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <p className="text-white">{selectedMedia.caption}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
