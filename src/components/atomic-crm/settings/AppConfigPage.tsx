import { Plus, Save, Trash2 } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { CrmDataProvider } from "../providers/types";
import {
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";
import { genderIconRegistry } from "../root/iconRegistry";
import {
  dehydrateContactGender,
  type StoredConfiguration,
} from "../root/storedConfiguration";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "company-sectors", label: "Company Sectors" },
  { id: "deal-stages", label: "Deal Stages" },
  { id: "deal-categories", label: "Deal Categories" },
  { id: "note-statuses", label: "Note Statuses" },
  { id: "task-types", label: "Task Types" },
  { id: "contact-gender", label: "Contact Gender" },
];

export const AppConfigPage = () => {
  const config = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const updateConfiguration = useConfigurationUpdater();
  const notify = useNotify();

  // Local form state
  const [title, setTitle] = useState(config.title);
  const [lightModeLogo, setLightModeLogo] = useState(config.lightModeLogo);
  const [darkModeLogo, setDarkModeLogo] = useState(config.darkModeLogo);
  const [companySectors, setCompanySectors] = useState(
    config.companySectors.join("\n"),
  );
  const [dealCategories, setDealCategories] = useState(
    config.dealCategories.join("\n"),
  );
  const [taskTypes, setTaskTypes] = useState(config.taskTypes.join("\n"));
  const [dealStages, setDealStages] = useState(config.dealStages);
  const [dealPipelineStatuses, setDealPipelineStatuses] = useState(
    config.dealPipelineStatuses,
  );
  const [noteStatuses, setNoteStatuses] = useState(config.noteStatuses);
  const [contactGender, setContactGender] = useState(
    dehydrateContactGender(config.contactGender),
  );
  const [saving, setSaving] = useState(false);

  // Sync form state when config changes (e.g. after DB load)
  useEffect(() => {
    setTitle(config.title);
    setLightModeLogo(config.lightModeLogo);
    setDarkModeLogo(config.darkModeLogo);
    setCompanySectors(config.companySectors.join("\n"));
    setDealCategories(config.dealCategories.join("\n"));
    setTaskTypes(config.taskTypes.join("\n"));
    setDealStages(config.dealStages);
    setDealPipelineStatuses(config.dealPipelineStatuses);
    setNoteStatuses(config.noteStatuses);
    setContactGender(dehydrateContactGender(config.contactGender));
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const storedConfig: StoredConfiguration = {
        title,
        lightModeLogo,
        darkModeLogo,
        companySectors: companySectors
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        dealCategories: dealCategories
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        taskTypes: taskTypes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        dealStages,
        dealPipelineStatuses,
        noteStatuses,
        contactGender,
      };
      const saved = await dataProvider.updateConfiguration(storedConfig);
      updateConfiguration(saved);
      notify("Configuration saved successfully");
    } catch {
      notify("Failed to save configuration", { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [
    title,
    lightModeLogo,
    darkModeLogo,
    companySectors,
    dealCategories,
    taskTypes,
    dealStages,
    dealPipelineStatuses,
    noteStatuses,
    contactGender,
    dataProvider,
    updateConfiguration,
    notify,
  ]);

  return (
    <div className="flex gap-8 mt-8 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">App Configuration</h1>

        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Branding
            </h2>
            <div className="space-y-2">
              <Label htmlFor="title">App Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lightModeLogo">Light Mode Logo URL</Label>
              <Input
                id="lightModeLogo"
                value={lightModeLogo}
                onChange={(e) => setLightModeLogo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="darkModeLogo">Dark Mode Logo URL</Label>
              <Input
                id="darkModeLogo"
                value={darkModeLogo}
                onChange={(e) => setDarkModeLogo(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Company Sectors */}
        <Card id="company-sectors">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Company Sectors
            </h2>
            <p className="text-sm text-muted-foreground">One sector per line</p>
            <Textarea
              value={companySectors}
              onChange={(e) => setCompanySectors(e.target.value)}
              rows={8}
            />
          </CardContent>
        </Card>

        {/* Deal Stages */}
        <Card id="deal-stages">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deal Stages
            </h2>
            {dealStages.map((stage, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Value"
                  value={stage.value}
                  onChange={(e) => {
                    const updated = [...dealStages];
                    updated[index] = { ...stage, value: e.target.value };
                    setDealStages(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Label"
                  value={stage.label}
                  onChange={(e) => {
                    const updated = [...dealStages];
                    updated[index] = { ...stage, label: e.target.value };
                    setDealStages(updated);
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() =>
                    setDealStages(dealStages.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                setDealStages([...dealStages, { value: "", label: "" }])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add Stage
            </Button>

            <Separator />

            <h3 className="text-lg font-medium text-muted-foreground">
              Pipeline Statuses
            </h3>
            <p className="text-sm text-muted-foreground">
              Select which deal stages count as "pipeline" (completed) deals.
            </p>
            <div className="flex flex-wrap gap-2">
              {dealStages.map((stage) => {
                const isSelected = dealPipelineStatuses.includes(stage.value);
                return (
                  <Button
                    key={stage.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isSelected) {
                        setDealPipelineStatuses(
                          dealPipelineStatuses.filter((s) => s !== stage.value),
                        );
                      } else {
                        setDealPipelineStatuses([
                          ...dealPipelineStatuses,
                          stage.value,
                        ]);
                      }
                    }}
                  >
                    {stage.label || stage.value}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Deal Categories */}
        <Card id="deal-categories">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deal Categories
            </h2>
            <p className="text-sm text-muted-foreground">
              One category per line
            </p>
            <Textarea
              value={dealCategories}
              onChange={(e) => setDealCategories(e.target.value)}
              rows={6}
            />
          </CardContent>
        </Card>

        {/* Note Statuses */}
        <Card id="note-statuses">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Note Statuses
            </h2>
            {noteStatuses.map((status, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Value"
                  value={status.value}
                  onChange={(e) => {
                    const updated = [...noteStatuses];
                    updated[index] = { ...status, value: e.target.value };
                    setNoteStatuses(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Label"
                  value={status.label}
                  onChange={(e) => {
                    const updated = [...noteStatuses];
                    updated[index] = { ...status, label: e.target.value };
                    setNoteStatuses(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  type="color"
                  value={status.color}
                  onChange={(e) => {
                    const updated = [...noteStatuses];
                    updated[index] = { ...status, color: e.target.value };
                    setNoteStatuses(updated);
                  }}
                  className="w-16 p-1 h-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() =>
                    setNoteStatuses(noteStatuses.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                setNoteStatuses([
                  ...noteStatuses,
                  { value: "", label: "", color: "#808080" },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add Status
            </Button>
          </CardContent>
        </Card>

        {/* Task Types */}
        <Card id="task-types">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Task Types
            </h2>
            <p className="text-sm text-muted-foreground">One type per line</p>
            <Textarea
              value={taskTypes}
              onChange={(e) => setTaskTypes(e.target.value)}
              rows={6}
            />
          </CardContent>
        </Card>

        {/* Contact Gender */}
        <Card id="contact-gender">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Contact Gender Options
            </h2>
            {contactGender.map((gender, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Value"
                  value={gender.value}
                  onChange={(e) => {
                    const updated = [...contactGender];
                    updated[index] = { ...gender, value: e.target.value };
                    setContactGender(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Label"
                  value={gender.label}
                  onChange={(e) => {
                    const updated = [...contactGender];
                    updated[index] = { ...gender, label: e.target.value };
                    setContactGender(updated);
                  }}
                  className="flex-1"
                />
                <Select
                  value={gender.icon}
                  onValueChange={(val) => {
                    const updated = [...contactGender];
                    updated[index] = { ...gender, icon: val };
                    setContactGender(updated);
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(genderIconRegistry).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() =>
                    setContactGender(
                      contactGender.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                setContactGender([
                  ...contactGender,
                  { value: "", label: "", icon: "User" },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add Gender Option
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

AppConfigPage.path = "/app-settings";
