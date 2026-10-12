'use client';

import {
  Currency,
  FurnishedStatus,
  HeatingType,
  Locale,
  PropertyType,
  REQUIRED_ATTRIBUTES,
  RentalPeriod,
  TransactionType,
  amenitiesFor,
  enumValues,
} from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Checkbox } from '@walls/ui/components/checkbox';
import { Field, FieldLabel } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Label } from '@walls/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@walls/ui/components/radio-group';
import { Switch } from '@walls/ui/components/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@walls/ui/components/tabs';
import { Textarea } from '@walls/ui/components/textarea';
import { LISTING_INPUT_LIMITS } from '@walls/validation';
import { LocateFixedIcon, MapPinIcon, SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, type FieldError, get, useFormContext, useWatch } from 'react-hook-form';
import { FormField, fieldAria } from '@/components/forms/form-field';
import { PositionError, currentPosition } from '@/lib/map/current-position';
import { type Coordinates, geocodeAddress } from '@/lib/map/map-provider';
import { AddressVisibilityField } from './address-visibility-field';
import { EnumSelect } from './enum-select';
import {
  type AttributeField,
  INTEGER_ATTRIBUTES,
  type ListingFormValues,
  NUMERIC_ATTRIBUTES,
  type NumericAttribute,
  VISIBLE_ATTRIBUTES,
} from './listing-form-model';
import { LocationMap } from './location-map';

const COORDINATE_DECIMALS = 6;
/** About 10 cm of precision, enough for a property and free of float noise. */
const roundCoordinate = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));

/** Field label with a marker for data required before submission. */
function useRequiredLabel() {
  return (label: string, required: boolean) => (required ? `${label} *` : label);
}

function useFieldError(path: string): FieldError | undefined {
  const { formState } = useFormContext<ListingFormValues>();
  return get(formState.errors, path) as FieldError | undefined;
}

export function BasicsSection({ editable }: { editable: boolean }) {
  const t = useTranslations('listings.editor.fields');
  const tEnums = useTranslations('enums');
  const label = useRequiredLabel();
  const { control } = useFormContext<ListingFormValues>();
  const propertyTypeError = useFieldError('propertyType');

  const propertyTypes = enumValues(PropertyType).map((value) => ({
    value,
    label: tEnums(`propertyType.${value}`),
  }));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Controller
        control={control}
        name="propertyType"
        render={({ field }) => (
          <FormField
            id="propertyType"
            label={label(t('propertyType'), true)}
            error={propertyTypeError}
          >
            <EnumSelect
              id="propertyType"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={propertyTypes}
              placeholder={t('choose')}
              disabled={!editable}
              invalid={Boolean(propertyTypeError)}
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="transactionType"
        render={({ field }) => (
          <Field>
            <Label id="transactionType-label">{label(t('transactionType'), true)}</Label>
            <RadioGroup
              aria-labelledby="transactionType-label"
              value={field.value === '' ? null : field.value}
              onValueChange={(value) => field.onChange(value)}
              disabled={!editable}
              className="flex gap-6"
            >
              {enumValues(TransactionType).map((value) => (
                <Label key={value} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={value} />
                  {tEnums(`transactionType.${value}`)}
                </Label>
              ))}
            </RadioGroup>
          </Field>
        )}
      />
    </div>
  );
}

export function TextsSection() {
  const t = useTranslations('listings.editor');
  const label = useRequiredLabel();
  const { register } = useFormContext<ListingFormValues>();
  const errors = {
    [Locale.SR]: {
      title: useFieldError('texts.sr.title'),
      description: useFieldError('texts.sr.description'),
    },
    [Locale.EN]: {
      title: useFieldError('texts.en.title'),
      description: useFieldError('texts.en.description'),
    },
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('sections.descriptionHint')}</p>
      <Tabs defaultValue={Locale.SR}>
        <TabsList>
          <TabsTrigger value={Locale.SR}>{t('fields.languageSr')}</TabsTrigger>
          <TabsTrigger value={Locale.EN}>{t('fields.languageEn')}</TabsTrigger>
        </TabsList>
        {([Locale.SR, Locale.EN] as const).map((locale) => {
          const required = locale === Locale.SR;
          const titleId = `texts-${locale}-title`;
          const descriptionId = `texts-${locale}-description`;
          // Kept mounted so both languages are validated and submitted.
          return (
            <TabsContent key={locale} value={locale} keepMounted className="space-y-4 pt-4">
              <FormField
                id={titleId}
                label={label(t('fields.title'), required)}
                error={errors[locale].title}
              >
                <Input
                  {...fieldAria(titleId, errors[locale].title)}
                  maxLength={LISTING_INPUT_LIMITS.titleMaxLength}
                  {...register(`texts.${locale}.title`)}
                />
              </FormField>
              <FormField
                id={descriptionId}
                label={label(t('fields.description'), required)}
                error={errors[locale].description}
              >
                <Textarea
                  {...fieldAria(descriptionId, errors[locale].description)}
                  rows={8}
                  maxLength={LISTING_INPUT_LIMITS.descriptionMaxLength}
                  {...register(`texts.${locale}.description`)}
                />
              </FormField>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

const ADDRESS_FIELDS = [
  { name: 'city', required: true, maxLength: LISTING_INPUT_LIMITS.cityMaxLength },
  { name: 'municipality', required: false, maxLength: LISTING_INPUT_LIMITS.areaNameMaxLength },
  { name: 'neighborhood', required: false, maxLength: LISTING_INPUT_LIMITS.areaNameMaxLength },
  { name: 'street', required: true, maxLength: LISTING_INPUT_LIMITS.streetMaxLength },
  { name: 'streetNumber', required: true, maxLength: LISTING_INPUT_LIMITS.streetNumberMaxLength },
  { name: 'postalCode', required: false, maxLength: LISTING_INPUT_LIMITS.postalCodeMaxLength },
] as const;

export function LocationSection({ editable }: { editable: boolean }) {
  const t = useTranslations('listings.editor.fields');
  const label = useRequiredLabel();
  const { register, control, setValue, getValues, formState } = useFormContext<ListingFormValues>();
  const latitude = useWatch({ control, name: 'location.latitude' });
  const longitude = useWatch({ control, name: 'location.longitude' });
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null);
  const [message, setMessage] = useState<
    'addressNotFound' | 'locationDenied' | 'locationUnavailable' | null
  >(null);

  function setCoordinates(value: Coordinates | null) {
    const options = { shouldDirty: true, shouldValidate: formState.isSubmitted };
    setValue('location.latitude', value ? roundCoordinate(value.latitude) : null, options);
    setValue('location.longitude', value ? roundCoordinate(value.longitude) : null, options);
  }

  /** Places the pin at the device's location; the browser asks for permission first. */
  async function locateMe() {
    setBusy('locate');
    setMessage(null);
    try {
      setCoordinates(await currentPosition());
    } catch (error) {
      const denied = error instanceof PositionError && error.reason === 'denied';
      setMessage(denied ? 'locationDenied' : 'locationUnavailable');
    } finally {
      setBusy(null);
    }
  }

  async function findOnMap() {
    const { street, streetNumber, city, municipality } = getValues('location');
    const query = [`${street} ${streetNumber}`.trim(), municipality, city]
      .filter(Boolean)
      .join(', ');
    if (!query) return;
    setBusy('search');
    setMessage(null);
    try {
      const found = await geocodeAddress(query);
      if (found) setCoordinates(found);
      else setMessage('addressNotFound');
    } catch {
      setMessage('addressNotFound');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="location-country">{label(t('country'), true)}</FieldLabel>
          <Input id="location-country" value={t('countryValue')} readOnly disabled />
        </Field>
        {ADDRESS_FIELDS.map(({ name, required, maxLength }) => (
          <AddressInput
            key={name}
            name={name}
            label={label(t(name), required)}
            maxLength={maxLength}
            register={register}
          />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{label(t('mapLocation'), true)}</p>
            <p className="text-sm text-muted-foreground">{t('mapHint')}</p>
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void findOnMap()}
              >
                <SearchIcon data-icon="inline-start" />
                {t('findOnMap')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void locateMe()}
              >
                <LocateFixedIcon data-icon="inline-start" />
                {busy === 'locate' ? t('locating') : t('useMyLocation')}
              </Button>
              {latitude !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCoordinates(null)}
                >
                  <XIcon data-icon="inline-start" />
                  {t('clearLocation')}
                </Button>
              )}
            </div>
          )}
        </div>
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {t(message)}
          </p>
        )}
        <LocationMap
          value={latitude !== null && longitude !== null ? { latitude, longitude } : null}
          onChange={setCoordinates}
          disabled={!editable}
          label={t('mapLocation')}
        />
        {latitude !== null && longitude !== null && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3" aria-hidden />
            {latitude}, {longitude}
          </p>
        )}
      </div>

      <AddressVisibilityField editable={editable} />
    </div>
  );
}

function AddressInput({
  name,
  label,
  maxLength,
  register,
}: {
  name: (typeof ADDRESS_FIELDS)[number]['name'];
  label: string;
  maxLength: number;
  register: ReturnType<typeof useFormContext<ListingFormValues>>['register'];
}) {
  const id = `location-${name}`;
  const error = useFieldError(`location.${name}`);
  return (
    <FormField id={id} label={label} error={error}>
      <Input {...fieldAria(id, error)} maxLength={maxLength} {...register(`location.${name}`)} />
    </FormField>
  );
}

export function DetailsSection({ editable }: { editable: boolean }) {
  const t = useTranslations('listings.editor.fields');
  const tEnums = useTranslations('enums');
  const label = useRequiredLabel();
  const { control } = useFormContext<ListingFormValues>();
  const propertyType = useWatch({ control, name: 'propertyType' });

  if (!propertyType) {
    return <p className="text-sm text-muted-foreground">{t('chooseTypeFirst')}</p>;
  }
  const visible = VISIBLE_ATTRIBUTES[propertyType];
  const required = new Set<AttributeField>(REQUIRED_ATTRIBUTES[propertyType]);
  const numeric = NUMERIC_ATTRIBUTES.filter((key) => visible.includes(key));

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {numeric.map((key) => (
        <NumberInput
          key={key}
          name={key}
          label={label(t(key), required.has(key))}
          hint={key === 'floor' ? t('floorHint') : undefined}
        />
      ))}
      {visible.includes('heatingType') && (
        <AttributeSelect
          name="heatingType"
          label={t('heatingType')}
          placeholder={t('notSpecified')}
          options={enumValues(HeatingType).map((value) => ({
            value,
            label: tEnums(`heatingType.${value}`),
          }))}
          editable={editable}
        />
      )}
      {visible.includes('furnishedStatus') && (
        <AttributeSelect
          name="furnishedStatus"
          label={t('furnishedStatus')}
          placeholder={t('notSpecified')}
          options={enumValues(FurnishedStatus).map((value) => ({
            value,
            label: tEnums(`furnishedStatus.${value}`),
          }))}
          editable={editable}
        />
      )}
    </div>
  );
}

function NumberInput({
  name,
  label,
  hint,
}: {
  name: NumericAttribute;
  label: string;
  hint?: string;
}) {
  const { register } = useFormContext<ListingFormValues>();
  const id = `attributes-${name}`;
  const error = useFieldError(`attributes.${name}`);
  return (
    <FormField id={id} label={label} description={hint} error={error}>
      <Input
        {...fieldAria(id, error, Boolean(hint))}
        inputMode={INTEGER_ATTRIBUTES.has(name) ? 'numeric' : 'decimal'}
        autoComplete="off"
        {...register(`attributes.${name}`)}
      />
    </FormField>
  );
}

function AttributeSelect<T extends HeatingType | FurnishedStatus>({
  name,
  label,
  placeholder,
  options,
  editable,
}: {
  name: 'heatingType' | 'furnishedStatus';
  label: string;
  placeholder: string;
  options: { value: T; label: string }[];
  editable: boolean;
}) {
  const { control } = useFormContext<ListingFormValues>();
  const id = `attributes-${name}`;
  return (
    <Controller
      control={control}
      name={`attributes.${name}`}
      render={({ field }) => (
        <FormField id={id} label={label}>
          <EnumSelect
            id={id}
            value={field.value as T | ''}
            onChange={field.onChange}
            options={options}
            placeholder={placeholder}
            disabled={!editable}
          />
        </FormField>
      )}
    />
  );
}

/** Features offered for the chosen property type (SPEC §10). */
export function AmenitiesSection({ editable }: { editable: boolean }) {
  const t = useTranslations('listings.editor.fields');
  const tAmenity = useTranslations('enums.amenity');
  const { control } = useFormContext<ListingFormValues>();
  const propertyType = useWatch({ control, name: 'propertyType' });
  const offered = amenitiesFor(propertyType || null);

  if (offered.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('chooseTypeFirst')}</p>;
  }
  return (
    <Controller
      control={control}
      name="amenityCodes"
      render={({ field }) => (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offered.map((code) => (
            <li key={code}>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={field.value.includes(code)}
                  disabled={!editable}
                  onCheckedChange={(next) =>
                    field.onChange(
                      next ? [...field.value, code] : field.value.filter((value) => value !== code),
                    )
                  }
                />
                {tAmenity(code)}
              </Label>
            </li>
          ))}
        </ul>
      )}
    />
  );
}

export function PriceSection({ editable }: { editable: boolean }) {
  const t = useTranslations('listings.editor.fields');
  const tEnums = useTranslations('enums');
  const label = useRequiredLabel();
  const { control, register, setValue } = useFormContext<ListingFormValues>();
  const onRequest = useWatch({ control, name: 'price.onRequest' });
  const transactionType = useWatch({ control, name: 'transactionType' });
  const amountError = useFieldError('price.amount');
  const periodError = useFieldError('price.period');
  const isRent = transactionType === TransactionType.RENT;

  return (
    <div className="space-y-6">
      <Controller
        control={control}
        name="price.onRequest"
        render={({ field }) => (
          <div className="flex items-start gap-3">
            <Switch
              id="price-onRequest"
              checked={field.value}
              disabled={!editable}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                // SPEC §11: choosing "price on request" clears any entered amount.
                if (checked) setValue('price.amount', '', { shouldDirty: true });
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="price-onRequest">{t('priceOnRequest')}</Label>
              <p className="text-sm text-muted-foreground">{t('priceOnRequestHint')}</p>
            </div>
          </div>
        )}
      />

      {!onRequest && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="price-amount" label={label(t('amount'), true)} error={amountError}>
            <Input
              {...fieldAria('price-amount', amountError)}
              inputMode="decimal"
              autoComplete="off"
              {...register('price.amount')}
            />
          </FormField>
          <Controller
            control={control}
            name="price.currency"
            render={({ field }) => (
              <FormField id="price-currency" label={t('currency')}>
                <EnumSelect
                  id="price-currency"
                  value={field.value}
                  onChange={(value) => field.onChange(value || field.value)}
                  options={enumValues(Currency).map((value) => ({ value, label: value }))}
                  placeholder={t('choose')}
                  disabled={!editable}
                />
              </FormField>
            )}
          />
          {isRent && (
            <Controller
              control={control}
              name="price.period"
              render={({ field }) => (
                <FormField id="price-period" label={label(t('period'), true)} error={periodError}>
                  <EnumSelect
                    id="price-period"
                    value={field.value}
                    onChange={field.onChange}
                    options={enumValues(RentalPeriod).map((value) => ({
                      value,
                      label: tEnums(`rentalPeriod.${value}`),
                    }))}
                    placeholder={t('choose')}
                    disabled={!editable}
                    invalid={Boolean(periodError)}
                  />
                </FormField>
              )}
            />
          )}
          <Controller
            control={control}
            name="price.negotiable"
            render={({ field }) => (
              <Label className="flex items-center gap-2 self-end pb-2 font-normal sm:col-span-full">
                <Checkbox
                  checked={field.value}
                  disabled={!editable}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                {t('negotiable')}
              </Label>
            )}
          />
        </div>
      )}
    </div>
  );
}
