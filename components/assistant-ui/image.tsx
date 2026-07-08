"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  ImageOffIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import type {
  ImageMessagePart,
  ImageMessagePartComponent,
} from "@assistant-ui/react";

import { cn } from "@/lib/utils";

const extensionForMimeType = (mimeType?: string): string => {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
};

const dataUriToBlob = (dataUri: string): Blob => {
  const [meta, data] = dataUri.split(",");
  const mime = meta?.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  if (!/;base64/i.test(meta ?? "")) {
    return new Blob([decodeURIComponent(data ?? "")], { type: mime });
  }
  const bytes = atob(data ?? "");
  const array = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    array[index] = bytes.charCodeAt(index);
  }
  return new Blob([array], { type: mime });
};

const mimeFromImage = (image: string): string | undefined =>
  image.match(/^data:([^;,]+)/)?.[1];

const downloadImagePart = (
  part: Pick<ImageMessagePart, "image" | "filename">,
): void => {
  if (typeof document === "undefined") return;
  const ext = extensionForMimeType(mimeFromImage(part.image));
  const filename = part.filename ?? `image.${ext}`;
  const isDataUri = part.image.startsWith("data:");
  const objectUrl = isDataUri
    ? URL.createObjectURL(dataUriToBlob(part.image))
    : null;
  const href = objectUrl ?? part.image;
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
};

const copyImagePart = async (
  part: Pick<ImageMessagePart, "image">,
): Promise<void> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof ClipboardItem === "undefined"
  ) {
    throw new Error("Clipboard API is not available in this environment.");
  }

  const blob = part.image.startsWith("data:")
    ? dataUriToBlob(part.image)
    : await fetch(part.image).then((response) => response.blob());
  const mime = mimeFromImage(part.image) ?? blob.type ?? "image/png";
  await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
};

const imageVariants = cva(
  "aui-image-root relative overflow-hidden rounded-lg",
  {
    variants: {
      variant: {
        outline: "border-border border",
        ghost: "",
        muted: "bg-muted/50",
      },
      size: {
        sm: "max-w-64",
        default: "max-w-96",
        lg: "max-w-[512px]",
        full: "w-full",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

export type ImageRootProps = React.ComponentProps<"div"> &
  VariantProps<typeof imageVariants>;

function ImageRoot({
  className,
  variant,
  size,
  children,
  ...props
}: ImageRootProps) {
  return (
    <div
      data-slot="image-root"
      data-size={size}
      data-variant={variant}
      className={cn(imageVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </div>
  );
}

type ImagePreviewProps = Omit<React.ComponentProps<"img">, "children"> & {
  containerClassName?: string;
};

function ImagePreview({
  className,
  containerClassName,
  onLoad,
  onError,
  alt = "Image content",
  src,
  ...props
}: ImagePreviewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const [errorSrc, setErrorSrc] = useState<string | undefined>(undefined);

  const loaded = loadedSrc === src;
  const error = errorSrc === src;

  useEffect(() => {
    if (
      typeof src === "string" &&
      imageRef.current?.complete &&
      imageRef.current.naturalWidth > 0
    ) {
      setLoadedSrc(src);
    }
  }, [src]);

  return (
    <div
      data-slot="image-preview"
      className={cn("relative min-h-32", containerClassName)}
    >
      {!loaded && !error ? (
        <div
          data-slot="image-preview-loading"
          className="bg-muted/50 absolute inset-0 flex items-center justify-center"
        >
          <ImageIcon className="text-muted-foreground size-8 animate-pulse" />
        </div>
      ) : null}
      {error ? (
        <div
          data-slot="image-preview-error"
          className="bg-muted/50 flex min-h-32 items-center justify-center p-4"
        >
          <ImageOffIcon className="text-muted-foreground size-8" />
        </div>
      ) : (
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className={cn(
            "block h-auto w-full object-contain",
            !loaded && "invisible",
            className,
          )}
          onLoad={(event) => {
            if (typeof src === "string") {
              setLoadedSrc(src);
            }
            onLoad?.(event);
          }}
          onError={(event) => {
            if (typeof src === "string") {
              setErrorSrc(src);
            }
            onError?.(event);
          }}
          {...props}
        />
      )}
    </div>
  );
}

function ImageFilename({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  if (!children) return null;

  return (
    <span
      data-slot="image-filename"
      className={cn(
        "text-muted-foreground block truncate px-2 py-1.5 text-xs",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

type ImageZoomProps = PropsWithChildren<{
  src: string;
  alt?: string;
}>;

function ImageZoom({ src, alt = "Image preview", children }: ImageZoomProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Click to zoom image"
        className="aui-image-zoom-trigger cursor-zoom-in"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </div>
      {mounted && open
        ? createPortal(
            <div
              data-slot="image-zoom-overlay"
              role="button"
              tabIndex={0}
              aria-label="Close zoomed image"
              className="aui-image-zoom-overlay fade-in animate-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 duration-200"
              onClick={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
            >
              <img
                data-slot="image-zoom-content"
                src={src}
                alt={alt}
                className="aui-image-zoom-content fade-in zoom-in-95 animate-in max-h-[90vh] max-w-[90vw] cursor-zoom-out object-contain duration-200"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ImageGenerating({ className }: { className?: string }) {
  return (
    <div
      data-slot="image-generating"
      className={cn(
        "bg-muted/50 flex min-h-32 items-center justify-center p-4",
        className,
      )}
    >
      <Loader2Icon className="text-muted-foreground size-8 animate-spin" />
      <span className="sr-only">Generating image...</span>
    </div>
  );
}

function ImageContentFilterError({
  className,
  reason,
}: {
  className?: string;
  reason?: string;
}) {
  return (
    <div
      data-slot="image-content-filter-error"
      className={cn(
        "bg-muted/50 flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center",
        className,
      )}
    >
      <ShieldAlertIcon className="text-muted-foreground size-8" />
      <p className="text-sm font-medium">Image could not be generated</p>
      {reason ? (
        <p className="text-muted-foreground text-xs">{reason}</p>
      ) : null}
    </div>
  );
}

export type ImageActionsProps = {
  part: ImageMessagePart;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
};

function RegenerateButton({
  onRegenerate,
}: {
  onRegenerate: () => void | Promise<void>;
}) {
  const [regenerating, setRegenerating] = useState(false);

  return (
    <button
      type="button"
      data-slot="image-regenerate"
      aria-label="Regenerate image"
      className="hover:bg-muted inline-flex size-7 items-center justify-center rounded disabled:opacity-50"
      disabled={regenerating}
      onClick={async () => {
        setRegenerating(true);
        try {
          await onRegenerate();
        } finally {
          setRegenerating(false);
        }
      }}
    >
      <RefreshCwIcon
        className={cn("size-4", regenerating && "animate-spin")}
      />
    </button>
  );
}

function ImageActions({ part, onRegenerate, className }: ImageActionsProps) {
  return (
    <div
      data-slot="image-actions"
      className={cn("flex items-center gap-1 p-1", className)}
    >
      <button
        type="button"
        data-slot="image-download"
        aria-label="Download image"
        className="hover:bg-muted inline-flex size-7 items-center justify-center rounded"
        onClick={() => downloadImagePart(part)}
      >
        <DownloadIcon className="size-4" />
      </button>
      <button
        type="button"
        data-slot="image-copy"
        aria-label="Copy image"
        className="hover:bg-muted inline-flex size-7 items-center justify-center rounded"
        onClick={() => {
          copyImagePart(part).catch(() => {});
        }}
      >
        <CopyIcon className="size-4" />
      </button>
      {onRegenerate ? <RegenerateButton onRegenerate={onRegenerate} /> : null}
    </div>
  );
}

const ImageImpl: ImageMessagePartComponent = (props) => {
  const { image, filename, status } = props;

  if (status?.type === "running") {
    return (
      <ImageRoot>
        <ImageGenerating />
        <ImageFilename>{filename}</ImageFilename>
      </ImageRoot>
    );
  }

  if (status?.type === "incomplete" && status.reason === "content-filter") {
    return (
      <ImageRoot>
        <ImageContentFilterError reason="The provider blocked this image." />
      </ImageRoot>
    );
  }

  return (
    <ImageRoot>
      <ImageZoom src={image} alt={filename || "Image content"}>
        <ImagePreview src={image} alt={filename || "Image content"} />
      </ImageZoom>
      <ImageFilename>{filename}</ImageFilename>
    </ImageRoot>
  );
};

const Image = memo(ImageImpl) as unknown as ImageMessagePartComponent & {
  Root: typeof ImageRoot;
  Preview: typeof ImagePreview;
  Filename: typeof ImageFilename;
  Zoom: typeof ImageZoom;
  Actions: typeof ImageActions;
  Generating: typeof ImageGenerating;
  ContentFilterError: typeof ImageContentFilterError;
};

Image.displayName = "Image";
Image.Root = ImageRoot;
Image.Preview = ImagePreview;
Image.Filename = ImageFilename;
Image.Zoom = ImageZoom;
Image.Actions = ImageActions;
Image.Generating = ImageGenerating;
Image.ContentFilterError = ImageContentFilterError;

export {
  Image,
  ImageActions,
  ImageContentFilterError,
  ImageFilename,
  ImageGenerating,
  ImagePreview,
  ImageRoot,
  ImageZoom,
  imageVariants,
};
