"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { FloatingActionPortal } from "@/components/floating-action-portal";
import { PrimaryActionButton } from "@/components/primary-action-button";
import { AddRuleForm } from "./add-rule-form";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface AddRuleButtonProps {
  tags: Tag[];
  customers: CustomerOption[];
}

/**
 * Floating "Add Rule" action that opens a modal hosting the add-rule form.
 * Replaces the previously always-visible inline form.
 */
export function AddRuleButton({ tags, customers }: AddRuleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <FloatingActionPortal>
        <PrimaryActionButton
          Icon={Plus}
          label="Add Rule"
          onClick={() => setIsOpen(true)}
        />
      </FloatingActionPortal>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Add Rule
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manually add a new extraction rule by entering a name and description.
                </p>
              </div>
            </div>
            <AddRuleForm
              tags={tags}
              customers={customers}
              onSuccess={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
