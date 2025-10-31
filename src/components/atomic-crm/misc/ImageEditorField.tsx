import { useFieldValue } from "ra-core";
import { createRef, useCallback, useState } from "react";
import type { ReactCropperElement } from "react-cropper";
import { Cropper } from "react-cropper";
import { useDropzone } from "react-dropzone";
import { useFormContext } from "react-hook-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import "cropperjs/dist/cropper.css";

const ImageEditorField = (props: ImageEditorFieldProps) => {
  const { getValues } = useFormContext();
  const source = getValues(props.source);
  const imageUrl = source?.src;
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { type = "image", emptyText, linkPosition = "none" } = props;

  const commonProps = {
    src: imageUrl,
    onClick: () => setIsDialogOpen(true),
    style: { cursor: "pointer" },
    className: `${props.className || ""}`,
  };

  const width = props.width || (type === "avatar" ? 50 : 200);
  const height = props.height || (type === "avatar" ? 50 : 200);

  return (
    <>
      <div
        className={`flex ${
          linkPosition === "right" ? "flex-row" : "flex-col"
        } items-center ${
          linkPosition === "right" ? "gap-2" : "gap-1"
        } rounded p-${props.backgroundImageColor ? "4" : "0"}`}
        style={{
          backgroundColor: props.backgroundImageColor || "transparent",
        }}
      >
        {props.type === "avatar" ? (
          <Avatar
            {...commonProps}
            className={`cursor-pointer`}
            style={{ width, height }}
          >
            <AvatarImage src={imageUrl} />
            <AvatarFallback>{emptyText}</AvatarFallback>
          </Avatar>
        ) : (
          <img
            {...commonProps}
            className="cursor-pointer object-cover"
            style={{ width, height }}
            alt="Editable content"
          />
        )}
        {linkPosition !== "none" && (
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="text-xs underline hover:no-underline cursor-pointer text-center"
          >
            Change
          </button>
        )}
      </div>
      <ImageEditorDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        {...props}
      />
    </>
  );
};

const ImageEditorDialog = (props: ImageEditorDialogProps) => {
  const { setValue, handleSubmit } = useFormContext();
  const cropperRef = createRef<ReactCropperElement>();
  const initialValue = useFieldValue({ source: props.source });
  const [file, setFile] = useState<File | undefined>();
  const [imageSrc, setImageSrc] = useState<string | undefined>(
    initialValue?.src,
  );
  const onDrop = useCallback((files: File[]) => {
    const preview = URL.createObjectURL(files[0]);
    setFile(files[0]);
    setImageSrc(preview);
  }, []);

  const updateImage = () => {
    const cropper = cropperRef.current?.cropper;
    const croppedImage = cropper?.getCroppedCanvas().toDataURL();
    if (croppedImage) {
      setImageSrc(croppedImage);

      const newFile = file ?? new File([], initialValue?.src);
      setValue(
        props.source,
        {
          src: croppedImage,
          title: newFile.name,
          rawFile: newFile,
        },
        { shouldDirty: true },
      );
      props.onClose();

      if (props.onSave) {
        handleSubmit(props.onSave)();
      }
    }
  };

  const deleteImage = () => {
    setValue(props.source, null, { shouldDirty: true });
    if (props.onSave) {
      handleSubmit(props.onSave)();
    }
    setImageSrc(undefined);
    props.onClose();
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/jpeg": [".jpeg", ".png"] },
    onDrop,
    maxFiles: 1,
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      {props.type === "avatar" && (
        <style>
          {`
                        .cropper-crop-box,
                        .cropper-view-box {
                            border-radius: 50%;
                        }
                    `}
        </style>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload and resize image</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 justify-center">
          <div
            className="flex flex-row justify-center bg-gray-50 cursor-pointer p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <p className="text-gray-600">
              Drop a file to upload, or click to select it.
            </p>
          </div>

          {imageSrc && (
            <Cropper
              ref={cropperRef}
              src={imageSrc}
              aspectRatio={1}
              guides={false}
              cropBoxResizable={false}
            />
          )}
        </div>

        <DialogFooter className="flex justify-between w-full">
          <Button type="button" onClick={updateImage}>
            Update Image
          </Button>
          <Button type="button" variant="destructive" onClick={deleteImage}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditorField;

export interface ImageEditorFieldProps {
  source: string;
  width?: number;
  height?: number;
  type?: "avatar" | "image";
  onSave?: any;
  linkPosition?: "right" | "bottom" | "none";
  backgroundImageColor?: string;
  className?: string;
  emptyText?: string;
}

export interface ImageEditorDialogProps extends ImageEditorFieldProps {
  open: boolean;
  onClose: () => void;
}
