"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORLD_COUNTRY_NAMES } from "@/data/world-countries";
import { getStateProvinceNamesForCountry } from "@/data/world-country-subdivisions";
import {
  ACCOUNT_RECOVERY_FIELD_STEPS,
  type AccountRecoveryFieldStepId,
} from "@/lib/account-recovery-form-helpers";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_VALUES,
  SECURITY_QUESTION_IDS,
  SECURITY_QUESTION_LABELS,
  SECURITY_QUESTION_SLOT_COUNT,
  accountTypeRequiresOrganizationName,
  emptySecurityQuestionSlots,
  organizationNameLabel,
  type AccountRecoveryFieldsValue,
  type AccountType,
  type MailingAddressFields,
  type SecurityQuestionId,
} from "@/lib/account-recovery-profile";

export type { AccountRecoveryFieldsValue };

function accountTypeLabel(value: string | null): string {
  if (!value) return "";
  if (value in ACCOUNT_TYPE_LABELS) {
    return ACCOUNT_TYPE_LABELS[value as AccountType];
  }
  return value;
}

function securityQuestionLabel(value: string | null): string {
  if (!value) return "";
  if (value in SECURITY_QUESTION_LABELS) {
    return SECURITY_QUESTION_LABELS[value as SecurityQuestionId];
  }
  return value;
}

function countryLabel(value: string | null): string {
  return value ?? "";
}

function stateProvinceLabel(value: string | null): string {
  return value ?? "";
}

function FieldSection({
  title,
  description,
  children,
  showHeading = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  showHeading?: boolean;
}) {
  return (
    <section className="space-y-3">
      {showHeading ? (
        <div className="space-y-1 border-b border-border/50 pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </h3>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground/90">
              {description}
            </p>
          ) : null}
        </div>
      ) : description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

export function AccountRecoveryFields({
  value,
  onChange,
  disabled,
  idPrefix = "account",
  nestedInModal = false,
  /** When set, only that slide’s fields are shown (1–3). */
  step,
}: {
  value: AccountRecoveryFieldsValue;
  onChange: (next: AccountRecoveryFieldsValue) => void;
  disabled?: boolean;
  idPrefix?: string;
  nestedInModal?: boolean;
  step?: AccountRecoveryFieldStepId;
}) {
  const showOrganization =
    value.accountType !== "" &&
    accountTypeRequiresOrganizationName(value.accountType);

  const selectValue = value.accountType === "" ? null : value.accountType;

  const selectedCountry = value.mailingAddress.country.trim();
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const useStateSelect = stateOptions.length > 0;

  useEffect(() => {
    let cancelled = false;
    if (!selectedCountry) {
      setStateOptions([]);
      setStatesLoading(false);
      return;
    }
    setStatesLoading(true);
    void getStateProvinceNamesForCountry(selectedCountry)
      .then((names) => {
        if (!cancelled) setStateOptions(names);
      })
      .catch(() => {
        if (!cancelled) setStateOptions([]);
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry]);

  const slots =
    value.securityQuestions.length === SECURITY_QUESTION_SLOT_COUNT
      ? value.securityQuestions
      : emptySecurityQuestionSlots();

  function updateSecuritySlot(
    index: number,
    patch: Partial<(typeof slots)[number]>,
  ) {
    const nextSlots = slots.map((slot, i) =>
      i === index ? { ...slot, ...patch } : slot,
    );
    onChange({ ...value, securityQuestions: nextSlots });
  }

  const showContact = step == null || step === 1;
  const showClassification = step == null || step === 2;
  const showSecurity = step == null || step === 3;
  const stepped = step != null;
  const stepMeta = stepped
    ? ACCOUNT_RECOVERY_FIELD_STEPS.find((entry) => entry.id === step)
    : null;

  return (
    <div className={stepped ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
      {showContact ? (
        <FieldSection
          title={ACCOUNT_RECOVERY_FIELD_STEPS[0].heading}
          description={
            stepped ? undefined : ACCOUNT_RECOVERY_FIELD_STEPS[0].description
          }
          showHeading={!stepped}
        >
          {stepped && stepMeta ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {stepMeta.description}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-phone`} className="text-sm font-medium">
              Phone number
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="e.g. +1 555 123 4567"
              value={value.phoneNumber}
              disabled={disabled}
              required
              className="h-10"
              onChange={(event) =>
                onChange({ ...value, phoneNumber: event.target.value })
              }
            />
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Mailing address
              </p>
              <p className="text-xs text-muted-foreground">
                Enter each part of the address where you can receive official
                correspondence.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`${idPrefix}-street-address`}
                className="text-sm font-medium"
              >
                Street address
              </Label>
              <Input
                id={`${idPrefix}-street-address`}
                type="text"
                autoComplete="street-address"
                placeholder="Street number and name"
                value={value.mailingAddress.streetAddress}
                disabled={disabled}
                required
                className="h-10"
                onChange={(event) =>
                  onChange({
                    ...value,
                    mailingAddress: {
                      ...value.mailingAddress,
                      streetAddress: event.target.value,
                    } satisfies MailingAddressFields,
                  })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`${idPrefix}-country`}
                className="text-sm font-medium"
              >
                Country
              </Label>
              <Select
                value={selectedCountry ? selectedCountry : null}
                disabled={disabled}
                itemToStringLabel={countryLabel}
                onValueChange={(next) => {
                  const country = next ?? "";
                  // Clear state immediately; options reload via effect for the new country.
                  onChange({
                    ...value,
                    mailingAddress: {
                      ...value.mailingAddress,
                      country,
                      stateProvince: "",
                    },
                  });
                }}
              >
                <SelectTrigger
                  id={`${idPrefix}-country`}
                  className="h-10 w-full"
                  aria-required
                >
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent nestedInModal={nestedInModal}>
                  {WORLD_COUNTRY_NAMES.map((country) => (
                    <SelectItem key={country} value={country} label={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`${idPrefix}-state-province`}
                  className="text-sm font-medium"
                >
                  State / province
                  {!useStateSelect && selectedCountry ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (optional)
                    </span>
                  ) : null}
                </Label>
                {statesLoading ? (
                  <Input
                    id={`${idPrefix}-state-province`}
                    type="text"
                    disabled
                    className="h-10"
                    placeholder="Loading states…"
                    value=""
                    readOnly
                  />
                ) : useStateSelect ? (
                  <Select
                    value={
                      value.mailingAddress.stateProvince.trim() &&
                      stateOptions.includes(value.mailingAddress.stateProvince)
                        ? value.mailingAddress.stateProvince
                        : null
                    }
                    disabled={disabled || !selectedCountry}
                    itemToStringLabel={stateProvinceLabel}
                    onValueChange={(next) => {
                      onChange({
                        ...value,
                        mailingAddress: {
                          ...value.mailingAddress,
                          stateProvince: next ?? "",
                        },
                      });
                    }}
                  >
                    <SelectTrigger
                      id={`${idPrefix}-state-province`}
                      className="h-10 w-full"
                      aria-required
                    >
                      <SelectValue placeholder="Select state / province" />
                    </SelectTrigger>
                    <SelectContent nestedInModal={nestedInModal}>
                      {stateOptions.map((state) => (
                        <SelectItem key={state} value={state} label={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`${idPrefix}-state-province`}
                    type="text"
                    autoComplete="address-level1"
                    placeholder={
                      selectedCountry
                        ? "State or province (optional)"
                        : "Select a country first"
                    }
                    value={value.mailingAddress.stateProvince}
                    disabled={disabled || !selectedCountry}
                    className="h-10"
                    onChange={(event) =>
                      onChange({
                        ...value,
                        mailingAddress: {
                          ...value.mailingAddress,
                          stateProvince: event.target.value,
                        },
                      })
                    }
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`${idPrefix}-city`}
                  className="text-sm font-medium"
                >
                  City
                </Label>
                <Input
                  id={`${idPrefix}-city`}
                  type="text"
                  autoComplete="address-level2"
                  placeholder="City"
                  value={value.mailingAddress.city}
                  disabled={disabled}
                  required
                  className="h-10"
                  onChange={(event) =>
                    onChange({
                      ...value,
                      mailingAddress: {
                        ...value.mailingAddress,
                        city: event.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`${idPrefix}-postal-code`}
                className="text-sm font-medium"
              >
                Postal code{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id={`${idPrefix}-postal-code`}
                type="text"
                autoComplete="postal-code"
                placeholder="Postal code"
                value={value.mailingAddress.postalCode}
                disabled={disabled}
                className="h-10"
                onChange={(event) =>
                  onChange({
                    ...value,
                    mailingAddress: {
                      ...value.mailingAddress,
                      postalCode: event.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </FieldSection>
      ) : null}

      {showClassification ? (
        <FieldSection
          title={ACCOUNT_RECOVERY_FIELD_STEPS[1].heading}
          description={
            stepped ? undefined : ACCOUNT_RECOVERY_FIELD_STEPS[1].description
          }
          showHeading={!stepped}
        >
          {stepped && stepMeta ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {stepMeta.description}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-account-type`}
              className="text-sm font-medium"
            >
              Type / status
            </Label>
            <Select
              value={selectValue}
              disabled={disabled}
              itemToStringLabel={accountTypeLabel}
              onValueChange={(next) => {
                if (next == null || next === "") {
                  onChange({
                    ...value,
                    accountType: "",
                    organizationName: "",
                  });
                  return;
                }
                const accountType = next as AccountType;
                onChange({
                  ...value,
                  accountType,
                  organizationName: accountTypeRequiresOrganizationName(
                    accountType,
                  )
                    ? value.organizationName
                    : "",
                });
              }}
            >
              <SelectTrigger
                id={`${idPrefix}-account-type`}
                className="h-10 w-full"
                aria-required
              >
                <SelectValue placeholder="Select type / status" />
              </SelectTrigger>
              <SelectContent nestedInModal={nestedInModal}>
                {ACCOUNT_TYPE_VALUES.map((type) => (
                  <SelectItem
                    key={type}
                    value={type}
                    label={ACCOUNT_TYPE_LABELS[type]}
                  >
                    {ACCOUNT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showOrganization ? (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`${idPrefix}-organization`}
                className="text-sm font-medium"
              >
                {organizationNameLabel(value.accountType as AccountType)}
              </Label>
              <Input
                id={`${idPrefix}-organization`}
                type="text"
                autoComplete="organization"
                placeholder={organizationNameLabel(
                  value.accountType as AccountType,
                )}
                value={value.organizationName}
                disabled={disabled}
                required
                className="h-10"
                onChange={(event) =>
                  onChange({ ...value, organizationName: event.target.value })
                }
              />
            </div>
          ) : null}
        </FieldSection>
      ) : null}

      {showSecurity ? (
        <FieldSection
          title={ACCOUNT_RECOVERY_FIELD_STEPS[2].heading}
          description={
            stepped ? undefined : ACCOUNT_RECOVERY_FIELD_STEPS[2].description
          }
          showHeading={!stepped}
        >
          {stepped && stepMeta ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {stepMeta.description}
            </p>
          ) : null}
          {slots.map((slot, index) => {
            const selectedElsewhere = new Set(
              slots
                .map((entry, i) => (i === index ? "" : entry.questionId))
                .filter(Boolean),
            );
            const questionValue =
              slot.questionId === "" ? null : slot.questionId;

            return (
              <div
                key={`security-slot-${index}`}
                className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3.5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Question {index + 1}
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={`${idPrefix}-security-q-${index}`}
                    className="text-sm font-medium"
                  >
                    Security question
                  </Label>
                  <Select
                    value={questionValue}
                    disabled={disabled}
                    itemToStringLabel={securityQuestionLabel}
                    onValueChange={(next) => {
                      if (next == null || next === "") {
                        updateSecuritySlot(index, { questionId: "" });
                        return;
                      }
                      updateSecuritySlot(index, {
                        questionId: next as SecurityQuestionId,
                      });
                    }}
                  >
                    <SelectTrigger
                      id={`${idPrefix}-security-q-${index}`}
                      className="h-10 w-full"
                      aria-required
                    >
                      <SelectValue placeholder="Select a security question" />
                    </SelectTrigger>
                    <SelectContent nestedInModal={nestedInModal}>
                      {SECURITY_QUESTION_IDS.map((questionId) => (
                        <SelectItem
                          key={questionId}
                          value={questionId}
                          label={SECURITY_QUESTION_LABELS[questionId]}
                          disabled={selectedElsewhere.has(questionId)}
                        >
                          {SECURITY_QUESTION_LABELS[questionId]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={`${idPrefix}-security-a-${index}`}
                    className="text-sm font-medium"
                  >
                    Answer
                  </Label>
                  <Input
                    id={`${idPrefix}-security-a-${index}`}
                    type="text"
                    autoComplete="off"
                    placeholder="Enter your answer"
                    value={slot.answer}
                    disabled={disabled}
                    required
                    className="h-10"
                    onChange={(event) =>
                      updateSecuritySlot(index, { answer: event.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </FieldSection>
      ) : null}
    </div>
  );
}
