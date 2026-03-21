import { useState } from "react";
import { useNavigate } from "react-router";
import { useDataProvider } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useConfigurationContext,
  useConfigurationUpdater,
  type CustomView,
} from "../root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";

interface CreateViewDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateViewDialog = ({ open, onClose }: CreateViewDialogProps) => {
  const updateConfiguration = useConfigurationUpdater();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const navigate = useNavigate();

  const [label, setLabel] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [saving, setSaving] = useState(false);

  const config = useConfigurationContext();
  const { companyTypes } = config;

  const handleSubmit = async () => {
    if (!label.trim() || !companyType) return;

    const id = `view-${Date.now()}`;
    const newView: CustomView = {
      id,
      label: label.trim(),
      companyType,
    };

    const newConfig = {
      ...config,
      customViews: [...(config.customViews ?? []), newView],
    };

    setSaving(true);
    try {
      await dataProvider.updateConfiguration(newConfig);
      updateConfiguration(newConfig);
    } finally {
      setSaving(false);
    }

    setLabel("");
    setCompanyType("");
    onClose();
    navigate(`/views/${id}`);
  };

  const handleClose = () => {
    setLabel("");
    setCompanyType("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle vue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="view-label">Nom de la vue</Label>
            <Input
              id="view-label"
              placeholder="Ex: Partenaires, Investisseurs..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="view-type">Type de société à afficher</Label>
            <Select value={companyType} onValueChange={setCompanyType}>
              <SelectTrigger id="view-type">
                <SelectValue placeholder="Choisir un type..." />
              </SelectTrigger>
              <SelectContent>
                {companyTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!label.trim() || !companyType || saving}
          >
            Créer la vue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
