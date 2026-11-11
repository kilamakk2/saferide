import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, ImageIcon, Loader2, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { BottomSheet } from "@/components/move/BottomSheet";
import { PhotoCropper } from "@/components/move/PhotoCropper";
import { StepLayout } from "@/components/move/Screen";
import { useMove } from "@/lib/move-store";
import { saveProfile } from "@/lib/session";
import { uploadImage } from "@/lib/upload";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/profile-photo")({
  head: () => pageHead("Set up your profile", "Add a photo so drivers recognise you quickly and safely."),
  component: ProfilePhoto,
});

function ProfilePhoto() {
  const navigate = useNavigate();
  const photo = useMove((s) => s.user.photo);
  const role = useMove((s) => s.user.role);
  const [sheet, setSheet] = useState(false);
  const [raw, setRaw] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const save = async (dataUrl: string) => {
    setRaw(null);
    setUploading(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const url = await uploadImage(blob, "profile.jpg");
      await saveProfile({ photo: url });
      toast.success("Photo saved");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't save your photo. Try again.");
    } finally {
      setUploading(false);
    }
  };
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setSheet(false);
    setRaw(URL.createObjectURL(f));
  };

  const next = () => navigate({ to: "/enable-location" });

  return (
    <>
      <StepLayout
        title="Set up your profile"
        subtitle={
          role === "driver"
            ? "Help passengers recognize you quickly and safely."
            : "Help drivers recognize you quickly and safely."
        }
        footer={
          <div className="mb-3 space-y-3">
            <AppButton disabled={uploading} onClick={photo ? next : () => setSheet(true)}>
              {uploading && <Loader2 className="size-4 animate-spin" />}
              {uploading ? "Saving photo..." : "Continue"}
            </AppButton>
            <AppButton variant="soft" onClick={next}>
              Maybe later
            </AppButton>
            <p className="text-center text-[11px] text-muted-foreground">You can change settings any time.</p>
          </div>
        }
      >
        <div className="mt-6 flex flex-col items-center">
          <button
            onClick={() => setSheet(true)}
            className="relative size-40 rounded-full bg-secondary transition-transform active:scale-95"
            aria-label="Add profile photo"
          >
            {uploading ? (
              <Loader2 className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : photo ? (
              <img src={photo} alt="Your profile" className="size-full rounded-full object-cover" />
            ) : (
              <UserRound className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 fill-muted-foreground text-muted-foreground" />
            )}
            <span className="absolute bottom-3 right-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
              {photo ? <Camera className="size-4" /> : <Plus className="size-4" />}
            </span>
          </button>
          <button onClick={() => setSheet(true)} className="mt-4 text-sm font-semibold text-primary">
            {photo ? "Change photo" : "Tap to add photo"}
          </button>
        </div>
      </StepLayout>

      <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Choose a photo">
        <div className="mb-4 divide-y divide-border">
          <button onClick={() => cameraRef.current?.click()} className="flex w-full items-center gap-3 py-3.5 text-sm">
            <Camera className="size-4" /> Take photo
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 py-3.5 text-sm">
            <ImageIcon className="size-4" /> Choose photo
          </button>
        </div>
      </BottomSheet>

      {raw && (
        <PhotoCropper
          src={raw}
          onCancel={() => setRaw(null)}
          onChoose={(url) => void save(url)}
        />
      )}
    </>
  );
}
