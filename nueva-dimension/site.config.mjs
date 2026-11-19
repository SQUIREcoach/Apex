// Single source of configuration. Values can be overridden with environment
// variables at build time (see README). Nothing here is secret.

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

export default {
  // Public URL where the site will live. Used for canonical, hreflang, sitemap and Open Graph.
  siteUrl: env('SITE_URL', 'https://apexpiscinas.com').replace(/\/$/, ''),
  // Staging builds must not be indexed: they would compete with the live site.
  // Set INDEXABLE=true only for the production build on the final domain.
  indexable: env('INDEXABLE', 'false') === 'true',

  brand: 'APEX Piscinas',
  phone: '+34711740427',
  phoneDisplay: '+34 711 740 427',
  email: 'apex@apexpiscinas.com',
  whatsapp: '34711740427',
  city: 'Barcelona',
  region: 'Cataluña',

  hubspot: {
    // Portal (account) ID — EU1 data centre. Confirm before going live.
    portalId: env('HUBSPOT_PORTAL_ID', '149296330'),
    region: env('HUBSPOT_REGION', 'eu1'),
    // Optional: GUID of a HubSpot form. If empty, the contact form posts to
    // HubSpot only through "collected forms" (tracking code) and offers email.
    formGuid: env('HUBSPOT_FORM_GUID', ''),
    meetingsUrl: env('HUBSPOT_MEETINGS_URL', 'https://meetings-eu1.hubspot.com/david374'),
  },

  // Google Analytics 4 measurement ID (G-XXXXXXX). Empty = analytics disabled.
  ga4: env('GA4_ID', ''),

  languages: [
    { code: 'es', path: '', label: 'ES', name: 'Castellano' },
    { code: 'ca', path: 'ca/', label: 'CA', name: 'Català' },
    { code: 'en', path: 'en/', label: 'EN', name: 'English' },
  ],
};
