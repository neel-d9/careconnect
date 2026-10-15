
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Card, PageHeader } from '../components/UI';
import { Loading, Empty, ErrorState } from '../components/State';
import {
  Stethoscope,
  MapPin,
  Clock,
  Pill,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  Activity,
} from 'lucide-react';

function formatLabel(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) =>
          typeof item === 'object'
            ? JSON.stringify(item)
            : String(item),
        ).join(', ')
      : 'None listed';
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => `${formatLabel(key)}: ${displayValue(val)}`)
      .join(' · ');
  }

  return String(value);
}

function getTitle(doc) {
  return (
    doc.clinic_name ||
    doc.clinicName ||
    doc.name ||
    doc.title ||
    doc.specialty ||
    doc.speciality ||
    'Medical Catalog Entry'
  );
}

function getSpecialties(doc) {
  const value =
    doc.specialties ||
    doc.specialities ||
    doc.specialty ||
    doc.speciality ||
    doc.departments ||
    doc.category;

  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getLocation(doc) {
  const location =
    doc.address ||
    doc.location ||
    doc.city ||
    doc.area;

  if (!location) return '';

  if (typeof location === 'string') return location;

  if (typeof location === 'object') {
    return [
      location.address,
      location.city,
      location.area,
      location.state,
    ]
      .filter(Boolean)
      .join(', ');
  }

  return '';
}

function CatalogCard({ doc }) {
  const [expanded, setExpanded] = useState(false);

  const excluded = new Set([
    '_id',
    'id',
    'clinic_name',
    'clinicName',
    'name',
    'title',
    'specialty',
    'speciality',
    'specialties',
    'specialities',
    'departments',
    'category',
    'address',
    'location',
    'city',
    'area',
  ]);

  const details = Object.entries(doc).filter(
    ([key, value]) =>
      !excluded.has(key) &&
      value !== null &&
      value !== undefined &&
      typeof value !== 'function',
  );

  const specialties = getSpecialties(doc);
  const location = getLocation(doc);

  const availability =
    doc.is_accepting_patients ??
    doc.available ??
    doc.isAvailable ??
    doc.availability;

  const isUnavailable =
    availability === false ||
    (typeof availability === 'string' &&
      /^(unavailable|closed|inactive|false)$/i.test(availability));

  return (
    <article className="medical-card">
      <div className="medical-card__top">
        <div className="medical-card__icon">
          <Building2 size={25} />
        </div>

        <div className="medical-card__heading">
          <h2>{getTitle(doc)}</h2>
          <p>Medical services &amp; information</p>
        </div>

        {availability !== undefined && (
          <span
            className={`medical-status ${
              isUnavailable ? 'medical-status--off' : 'medical-status--on'
            }`}
          >
            <span className="medical-status__dot" />
            {isUnavailable ? 'Unavailable' : 'Available'}
          </span>
        )}
      </div>

      {specialties.length > 0 && (
        <div className="medical-card__specialties">
          {specialties.map((item, index) => (
            <span className="medical-chip" key={`${item}-${index}`}>
              <Stethoscope size={13} />
              {typeof item === 'object'
                ? displayValue(item)
                : String(item)}
            </span>
          ))}
        </div>
      )}

      {location && (
        <div className="medical-card__location">
          <MapPin size={16} />
          <span>{location}</span>
        </div>
      )}

      <div className="medical-card__summary">
        {details.slice(0, 3).map(([key, value]) => {
          const Icon =
            /time|hour|schedule|availability/i.test(key)
              ? Clock
              : /medicine|medication|drug|treatment/i.test(key)
                ? Pill
                : /special|service|department/i.test(key)
                  ? Stethoscope
                  : /description|detail|note/i.test(key)
                    ? FileText
                    : Activity;

          return (
            <div className="medical-detail" key={key}>
              <span className="medical-detail__icon">
                <Icon size={16} />
              </span>
              <div className="medical-detail__content">
                <span className="medical-detail__label">
                  {formatLabel(key)}
                </span>
                <span className="medical-detail__value">
                  {displayValue(value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {details.length > 3 && (
        <>
          {expanded && (
            <div className="medical-card__extra">
              {details.slice(3).map(([key, value]) => (
                <div className="medical-extra-row" key={key}>
                  <span>{formatLabel(key)}</span>
                  <strong>{displayValue(value)}</strong>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="medical-card__toggle"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'View all details'}
            {expanded ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        </>
      )}
    </article>
  );
}

export default function Catalog() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    api
      .get('/medical-catalog')
      .then((x) => {
        if (active) setD(x.data.data);
      })
      .catch((e) => {
        if (active) {
          setErr(
            e.response?.data?.error?.message ||
              'MedicalCatalogs is unavailable',
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = (d || []).filter((doc) =>
    JSON.stringify(doc)
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );

  return (
    <div className="catalog-page">
      <PageHeader
        eyebrow="CARECONNECT · DIRECTORY"
        title="Medical catalog"
        description="Explore clinic information, specialties, and medical service details."
      />

      {err ? (
        <ErrorState message={err} />
      ) : !d ? (
        <Loading />
      ) : !d.length ? (
        <Empty title="No catalog documents" />
      ) : (
        <>
          <div className="catalog-toolbar">
            <div className="catalog-toolbar__search">
              <Search size={19} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clinics, specialties, services..."
                aria-label="Search medical catalog"
              />
            </div>

            <div className="catalog-count">
              <span>{filtered.length}</span>
              {filtered.length === 1 ? 'entry found' : 'entries found'}
            </div>
          </div>

          {filtered.length === 0 ? (
            <Empty title="No matching catalog entries" />
          ) : (
            <div className="catalog-grid">
              {filtered.map((doc, i) => (
                <CatalogCard
                  key={doc._id || doc.id || i}
                  doc={doc}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
